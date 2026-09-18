import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AttendancePerScholarComponent } from './attendance-per-scholar.component';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { AttendanceService } from '../../services/attendance.service';
import { CsvExportService } from '../../services/csv-export.service';
import { NotificationService } from '../../services/notification.service';
import { getWeekdayDatesInMonth } from '../../utils/weekday-dates';
import type { Scholar } from '../../interfaces/scholar';
import type { School } from '../../interfaces/school';
import type { AttendanceRecord } from '../../interfaces/attendance-record';

// First TestBed-backed component spec in the app (see ai_docs/angular-frontend.md) —
// written as a regression net for AttendancePerScholarComponent before migrating it off
// plain mutable fields + manual ChangeDetectorRef.markForCheck() onto signals, and now
// also the spec for that signals version. Covers the day-row/persistence/cascade rules
// and the save flow.

const SCHOLAR: Scholar = {
  id: 'scholar-1',
  firstName: 'Ana',
  lastName: 'Popescu',
  pickUpSchedule: null,
  schoolId: 1,
  grade: 3,
  dateOfBirth: new Date('2016-01-01'),
};

const SCHOOL: School = {
  id: 1,
  name: 'Test School',
  color: '#336699',
  lunchPrice: 15,
  transportPrice: 10,
};

// A Monday — getWeekdayDatesInMonth always includes it, keeping the "existing
// record" fixture independent of which weekdays March happens to start/end on.
const EXISTING_DATE = '2024-03-04';

// A factory, not a shared const: dayRows holds a direct reference into whatever
// array setup() passes in, and several tests mutate that record in place (that's
// the app's own real behavior — see allAttendanceRecords' doc comment). Sharing
// one object across tests would leak mutations from one test into the next.
function makeExistingRecord(): AttendanceRecord {
  return {
    date: EXISTING_DATE,
    lunchCost: 15,
    transportCost: 0,
    present: true,
    lunchSelected: true,
    transportSelected: false,
  };
}

interface SetupOptions {
  attendance?: AttendanceRecord[];
  saveResult?: 'success' | 'error';
  routeScholarId?: string | null;
}

function setup(options: SetupOptions = {}) {
  const scholarsService = { getScholars: vi.fn(() => of([SCHOLAR])) };
  const schoolsService = { getSchoolById: vi.fn(() => of(SCHOOL)) };
  const saveAttendance = vi.fn(() =>
    options.saveResult === 'error'
      ? throwError(
          () => new Error('saveAttendance id=scholar-1 failed: Scholar not found.'),
        )
      : of({ message: 'Attendance record saved successfully.' }),
  );
  const attendanceService = {
    getAttendanceByScholarId: vi.fn(() => of(options.attendance ?? [makeExistingRecord()])),
    saveAttendance,
  };
  const csvExportService = { export: vi.fn() };
  const notificationService = { show: vi.fn() };

  TestBed.configureTestingModule({
    imports: [AttendancePerScholarComponent],
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: convertToParamMap(
              options.routeScholarId === undefined
                ? { id: SCHOLAR.id }
                : options.routeScholarId === null
                  ? {}
                  : { id: options.routeScholarId },
            ),
          },
        },
      },
      { provide: ScholarsService, useValue: scholarsService },
      { provide: SchoolsService, useValue: schoolsService },
      { provide: AttendanceService, useValue: attendanceService },
      { provide: CsvExportService, useValue: csvExportService },
      { provide: NotificationService, useValue: notificationService },
    ],
  });

  const fixture: ComponentFixture<AttendancePerScholarComponent> = TestBed.createComponent(
    AttendancePerScholarComponent,
  );
  fixture.detectChanges(); // runs ngOnInit; every service call above is a synchronous `of`/`throwError`

  return {
    fixture,
    component: fixture.componentInstance,
    scholarsService,
    schoolsService,
    attendanceService,
    csvExportService,
    notificationService,
  };
}

function dayRow(component: AttendancePerScholarComponent, date: string) {
  const row = component.dayRows().find((r) => r.date === date);
  if (!row) throw new Error(`No day row for ${date}`);
  return row;
}

function checkedEvent(checked: boolean): Event {
  return { target: { checked } } as unknown as Event;
}

describe('AttendancePerScholarComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('loading', () => {
    it('renders the scholar name once the scholar/school/attendance load', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement.textContent).toContain('Ana Popescu');
    });

    it('shows a loading message before the scholar has loaded', () => {
      const { fixture } = setup({ routeScholarId: null });
      expect(fixture.nativeElement.textContent).toContain('Loading attendance...');
    });

    it('does nothing and calls no service when the route has no scholar id', () => {
      const { scholarsService } = setup({ routeScholarId: null });
      expect(scholarsService.getScholars).not.toHaveBeenCalled();
    });

    it('defaults to the month of the latest existing attendance record', () => {
      const { component } = setup();
      expect(component.selectedMonth()).toBe('2024-03');
    });

    it('defaults to the current month when the scholar has no attendance yet', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-07-15T00:00:00'));

      const { component } = setup({ attendance: [] });

      expect(component.selectedMonth()).toBe('2024-07');
    });

    it('marks the day with an existing record as persisted, with its saved values', () => {
      const { component } = setup();
      const row = dayRow(component, EXISTING_DATE);

      expect(row.isPersisted).toBe(true);
      expect(row.record.lunchSelected).toBe(true);
      expect(row.record.lunchCost).toBe(15);
    });

    it('marks every other day of the month as not yet persisted', () => {
      const { component } = setup();
      const otherDate = getWeekdayDatesInMonth(2024, 3).find((d) => d !== EXISTING_DATE)!;
      const row = dayRow(component, otherDate);

      expect(row.isPersisted).toBe(false);
      expect(row.record.lunchSelected).toBe(false);
      expect(row.record.transportSelected).toBe(false);
    });
  });

  describe('checking a day (DOM-level)', () => {
    it('Lunch, Transport, and Both are all disabled until Present is checked, on an untouched day', () => {
      const { fixture, component } = setup();
      const untouchedDate = getWeekdayDatesInMonth(2024, 3).find((d) => d !== EXISTING_DATE)!;
      const rowIndex = component.dayRows().findIndex((r) => r.date === untouchedDate);

      const rowEls = fixture.nativeElement.querySelectorAll('.attendance-table__row');
      const checkboxes: NodeListOf<HTMLInputElement> = rowEls[rowIndex].querySelectorAll(
        'input[type="checkbox"]',
      );
      const [presentCheckbox, lunchCheckbox, transportCheckbox, bothCheckbox] = checkboxes;

      expect(presentCheckbox.checked).toBe(false);
      expect(lunchCheckbox.disabled).toBe(true);
      expect(transportCheckbox.disabled).toBe(true);
      expect(bothCheckbox.disabled).toBe(true);

      presentCheckbox.checked = true;
      presentCheckbox.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(lunchCheckbox.disabled).toBe(false);
      expect(transportCheckbox.disabled).toBe(false);
      expect(bothCheckbox.disabled).toBe(false);

      lunchCheckbox.checked = true;
      lunchCheckbox.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      const row = dayRow(component, untouchedDate);
      expect(row.record.lunchSelected).toBe(true);
      expect(row.record.lunchCost).toBe(SCHOOL.lunchPrice);
      expect(row.isPersisted).toBe(true);
      expect(component.allAttendanceRecords).toContain(row.record);
      expect(component.hasUnsavedChanges()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Unsaved changes');
    });

    it('the Present checkbox itself reflects the existing record for an already-persisted day', () => {
      const { fixture, component } = setup();
      const rowIndex = component.dayRows().findIndex((r) => r.date === EXISTING_DATE);

      const rowEls = fixture.nativeElement.querySelectorAll('.attendance-table__row');
      const [presentCheckbox]: NodeListOf<HTMLInputElement> = rowEls[rowIndex].querySelectorAll(
        'input[type="checkbox"]',
      );

      expect(presentCheckbox.checked).toBe(true);
      expect(presentCheckbox.disabled).toBe(false);
    });
  });

  describe('Present gates Lunch/Transport', () => {
    it('checking Lunch/Transport/Both is a no-op while Present is false', () => {
      const { component } = setup();
      const row = dayRow(component, getWeekdayDatesInMonth(2024, 3).find((d) => d !== EXISTING_DATE)!);

      component.onLunchChange(row, checkedEvent(true));
      component.onTransportChange(row, checkedEvent(true));
      component.onBothChange(row, checkedEvent(true));

      expect(row.record.lunchSelected).toBe(false);
      expect(row.record.transportSelected).toBe(false);
      expect(row.isPersisted).toBe(false);
    });

    it('unchecking Present clears an already-checked Lunch and Transport', () => {
      const { component } = setup();
      const row = dayRow(component, EXISTING_DATE); // present: true, lunchSelected: true
      row.record.transportSelected = true;

      component.onPresentChange(row, checkedEvent(false));

      expect(row.record.present).toBe(false);
      expect(row.record.lunchSelected).toBe(false);
      expect(row.record.transportSelected).toBe(false);
    });

    it('checking Present on an untouched day persists it even with nothing else selected', () => {
      const { component } = setup();
      const row = dayRow(component, getWeekdayDatesInMonth(2024, 3).find((d) => d !== EXISTING_DATE)!);

      component.onPresentChange(row, checkedEvent(true));

      expect(row.record.present).toBe(true);
      expect(row.isPersisted).toBe(true);
      expect(component.allAttendanceRecords).toContain(row.record);
    });

    it('unchecking Present on an untouched day (already false) does not persist it', () => {
      const { component } = setup();
      const row = dayRow(component, getWeekdayDatesInMonth(2024, 3).find((d) => d !== EXISTING_DATE)!);

      component.onPresentChange(row, checkedEvent(false));

      expect(row.record.present).toBe(false);
      expect(row.isPersisted).toBe(false);
      expect(component.allAttendanceRecords).not.toContain(row.record);
    });

    it('unchecking Present on an already-persisted day keeps it persisted, with Lunch/Transport cleared', () => {
      const { component } = setup();
      const row = dayRow(component, EXISTING_DATE); // present: true, lunchSelected: true, isPersisted: true

      component.onPresentChange(row, checkedEvent(false));

      expect(row.isPersisted).toBe(true);
      expect(component.allAttendanceRecords).toContain(row.record);
      expect(row.record.lunchSelected).toBe(false);
    });
  });

  describe('Lunch and Transport are independent', () => {
    it('checking Lunch does not touch Transport', () => {
      const { component } = setup();
      const row = dayRow(component, getWeekdayDatesInMonth(2024, 3).find((d) => d !== EXISTING_DATE)!);
      row.record.present = true;

      component.onLunchChange(row, checkedEvent(true));

      expect(row.record.lunchSelected).toBe(true);
      expect(row.record.transportSelected).toBe(false);
    });

    it('unchecking Lunch leaves an already-checked Transport untouched', () => {
      const { component } = setup();
      const row = dayRow(component, EXISTING_DATE); // lunchSelected: true from the fixture
      row.record.transportSelected = true;

      component.onLunchChange(row, checkedEvent(false));

      expect(row.record.lunchSelected).toBe(false);
      expect(row.record.transportSelected).toBe(true);
    });

    it('checking Transport seeds its cost from the school price, persists the row, and does not touch Lunch', () => {
      const { component } = setup();
      const row = dayRow(component, getWeekdayDatesInMonth(2024, 3).find((d) => d !== EXISTING_DATE)!);
      row.record.present = true;

      component.onTransportChange(row, checkedEvent(true));

      expect(row.record.transportSelected).toBe(true);
      expect(row.record.transportCost).toBe(SCHOOL.transportPrice);
      expect(row.isPersisted).toBe(true);
      expect(row.record.lunchSelected).toBe(false);
    });

    it('unchecking Transport leaves an already-checked Lunch untouched', () => {
      const { component } = setup();
      const row = dayRow(component, EXISTING_DATE); // lunchSelected: true from the fixture

      component.onTransportChange(row, checkedEvent(false));

      expect(row.record.lunchSelected).toBe(true);
    });

    it('the "Both" checkbox reflects true only once both are independently checked', () => {
      const { fixture, component } = setup();
      const row = dayRow(component, EXISTING_DATE); // lunchSelected: true, transportSelected: false
      const rowIndex = component.dayRows().findIndex((r) => r.date === EXISTING_DATE);
      const bothCheckbox: HTMLInputElement = fixture.nativeElement.querySelectorAll(
        '.attendance-table__row',
      )[rowIndex].querySelectorAll('input[type="checkbox"]')[3];

      expect(bothCheckbox.checked).toBe(false);

      component.onTransportChange(row, checkedEvent(true));
      fixture.detectChanges();

      expect(bothCheckbox.checked).toBe(true);
    });

    it('"Both" checks Lunch and Transport together and seeds both costs', () => {
      const { component } = setup();
      const row = dayRow(component, getWeekdayDatesInMonth(2024, 3).find((d) => d !== EXISTING_DATE)!);
      row.record.present = true;

      component.onBothChange(row, checkedEvent(true));

      expect(row.record.lunchSelected).toBe(true);
      expect(row.record.transportSelected).toBe(true);
      expect(row.record.lunchCost).toBe(SCHOOL.lunchPrice);
      expect(row.record.transportCost).toBe(SCHOOL.transportPrice);
      expect(row.isPersisted).toBe(true);
    });
  });

  describe('totals', () => {
    it('sums only the selected costs across the month', () => {
      const { component } = setup();
      const otherDate = getWeekdayDatesInMonth(2024, 3).find((d) => d !== EXISTING_DATE)!;
      const row = dayRow(component, otherDate);
      row.record.present = true;

      component.onTransportChange(row, checkedEvent(true));

      expect(component.totalSelectedLunchCost()).toBe(15); // from the existing record
      expect(component.totalSelectedTransportCost()).toBe(SCHOOL.transportPrice);
      expect(component.grandTotal()).toBe(15 + SCHOOL.transportPrice);
    });
  });

  describe('changing the month', () => {
    it('rebuilds dayRows for the new month, with nothing persisted outside March', () => {
      const { component } = setup();

      component.onMonthChange({ target: { value: '2024-04' } } as unknown as Event);

      expect(component.selectedMonth()).toBe('2024-04');
      expect(component.dayRows().length).toBe(getWeekdayDatesInMonth(2024, 4).length);
      expect(component.dayRows().every((r) => !r.isPersisted)).toBe(true);
    });
  });

  describe('save', () => {
    it('sends the scholar id and full records list, and shows a success notification', () => {
      const { component, attendanceService, notificationService } = setup();

      component.save();

      expect(attendanceService.saveAttendance).toHaveBeenCalledWith(
        SCHOLAR.id,
        component.allAttendanceRecords,
      );
      expect(notificationService.show).toHaveBeenCalledWith('Attendance saved successfully!');
      expect(component.isSaving()).toBe(false);
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('shows the server-provided error message on failure and clears isSaving', () => {
      const { component, notificationService } = setup({ saveResult: 'error' });

      component.save();

      expect(notificationService.show).toHaveBeenCalledWith(
        expect.stringContaining('Scholar not found.'),
        'error',
      );
      expect(component.isSaving()).toBe(false);
    });

    it('is a no-op while a save is already in flight', () => {
      const { component, attendanceService } = setup();
      component.isSaving.set(true);

      component.save();

      expect(attendanceService.saveAttendance).not.toHaveBeenCalled();
    });
  });

  describe('exportCsv', () => {
    it('passes a scholar-and-month-scoped filename and the current day rows', () => {
      const { component, csvExportService } = setup();

      component.exportCsv();

      expect(csvExportService.export).toHaveBeenCalledWith(
        'attendance_Ana_Popescu_2024-03',
        expect.any(Array),
        component.dayRows(),
      );
    });

    it('includes a Present column, rendered as Yes/No, right after Date', () => {
      const { component, csvExportService } = setup();

      component.exportCsv();

      const columns = csvExportService.export.mock.calls[0][1] as {
        header: string;
        value: (row: { record: { present: boolean } }) => string;
      }[];
      const headers = columns.map((c) => c.header);
      expect(headers.indexOf('Present')).toBe(headers.indexOf('Date') + 1);

      const presentColumn = columns.find((c) => c.header === 'Present')!;
      expect(presentColumn.value({ record: { present: true } })).toBe('Yes');
      expect(presentColumn.value({ record: { present: false } })).toBe('No');
    });
  });
});
