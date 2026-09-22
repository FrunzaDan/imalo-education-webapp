import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AttendancePerScholarComponent } from './attendance-per-scholar.component';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { AttendanceService } from '../../services/attendance.service';
import { CsvExportService } from '../../services/csv-export.service';
import { NotificationService } from '../../services/notification.service';
import { getWeekdayDatesInMonth } from '../../utils/weekday-dates';
import { toDateOnly } from './attendance-form';
import type { Scholar } from '../../interfaces/scholar';
import type { School } from '../../interfaces/school';
import type { AttendanceRecord } from '../../interfaces/attendance-record';

// TestBed spec for AttendancePerScholarComponent (see ai_docs/angular-frontend.md). Covers
// the day-row/persistence/gating rules and the save flow. The rules are driven the way a
// user drives them — real checkbox clicks, which fire `input` (what [formField] listens
// to) and then `change` (what the rule handlers listen to) — so the template wiring is
// under test too, not just the handlers.

const SCHOLAR: Scholar = {
  id: 'scholar-1',
  firstName: 'Ana',
  lastName: 'Popescu',
  pickUpSchedule: null,
  schoolId: 1,
  grade: 3,
  dateOfBirth: '2016-01-01',
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
  // The route's :id reaches the component as an input (withComponentInputBinding()).
  const routeId = options.routeScholarId === undefined ? SCHOLAR.id : options.routeScholarId;
  if (routeId !== null) fixture.componentRef.setInput('id', routeId);
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

// A March 2024 weekday with no saved record.
const UNTOUCHED_DATE = getWeekdayDatesInMonth(2024, 3).find((d) => d !== EXISTING_DATE)!;

type Box = 'present' | 'lunch' | 'transport' | 'both';
const BOX_ORDER: Box[] = ['present', 'lunch', 'transport', 'both'];

type Setup = ReturnType<typeof setup>;

function checkbox({ fixture, component }: Setup, date: string, box: Box): HTMLInputElement {
  const index = component.dayRows().findIndex((r) => toDateOnly(r.date) === date);
  const rowEl = fixture.nativeElement.querySelectorAll('.attendance-table__row')[index];
  return rowEl.querySelectorAll('input[type="checkbox"]')[BOX_ORDER.indexOf(box)];
}

// A real user click: toggles the box, fires `input` then `change`, then re-renders.
function click(ctx: Setup, date: string, box: Box): void {
  checkbox(ctx, date, box).click();
  ctx.fixture.detectChanges();
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

      expect(row.persisted).toBe(true);
      expect(row.lunchSelected).toBe(true);
      expect(row.lunchCost).toBe(15);
    });

    it('marks every other day of the month as not yet persisted', () => {
      const { component } = setup();
      const row = dayRow(component, UNTOUCHED_DATE);

      expect(row.persisted).toBe(false);
      expect(row.lunchSelected).toBe(false);
      expect(row.transportSelected).toBe(false);
    });

    it('lists the month\'s weekdays in date order, whatever order the records arrived in', () => {
      const { component } = setup({
        attendance: [
          { ...makeExistingRecord(), date: '2024-03-20' },
          { ...makeExistingRecord(), date: '2024-03-05' },
        ],
      });

      const dates = component.dayRows().map((r) => r.date);
      expect(dates).toEqual([...dates].sort());
      expect(dates).toEqual(getWeekdayDatesInMonth(2024, 3));
    });
  });

  describe('checking a day (DOM-level)', () => {
    it('Lunch, Transport, and Both are all disabled until Present is checked, on an untouched day', () => {
      const ctx = setup();
      const { fixture, component } = ctx;

      expect(checkbox(ctx, UNTOUCHED_DATE, 'present').checked).toBe(false);
      for (const box of ['lunch', 'transport', 'both'] as const) {
        expect(checkbox(ctx, UNTOUCHED_DATE, box).disabled).toBe(true);
      }

      click(ctx, UNTOUCHED_DATE, 'present');
      for (const box of ['lunch', 'transport', 'both'] as const) {
        expect(checkbox(ctx, UNTOUCHED_DATE, box).disabled).toBe(false);
      }

      click(ctx, UNTOUCHED_DATE, 'lunch');

      const row = dayRow(component, UNTOUCHED_DATE);
      expect(row.lunchSelected).toBe(true);
      expect(row.lunchCost).toBe(SCHOOL.lunchPrice);
      expect(row.persisted).toBe(true);
      expect(component.recordsToSave().map((r) => r.date)).toContain(UNTOUCHED_DATE);
      expect(component.hasUnsavedChanges()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Unsaved changes');
    });

    it('the Present checkbox itself reflects the existing record for an already-persisted day', () => {
      const ctx = setup();

      expect(checkbox(ctx, EXISTING_DATE, 'present').checked).toBe(true);
      expect(checkbox(ctx, EXISTING_DATE, 'present').disabled).toBe(false);
      expect(checkbox(ctx, EXISTING_DATE, 'lunch').checked).toBe(true);
    });
  });

  describe('Present gates Lunch/Transport', () => {
    it('clicking Lunch/Transport/Both is a no-op while Present is false', () => {
      const ctx = setup();

      click(ctx, UNTOUCHED_DATE, 'lunch');
      click(ctx, UNTOUCHED_DATE, 'transport');
      click(ctx, UNTOUCHED_DATE, 'both');

      const row = dayRow(ctx.component, UNTOUCHED_DATE);
      expect(row.lunchSelected).toBe(false);
      expect(row.transportSelected).toBe(false);
      expect(row.persisted).toBe(false);
      expect(ctx.component.hasUnsavedChanges()).toBe(false);
    });

    it('unchecking Present clears an already-checked Lunch and Transport', () => {
      const ctx = setup();
      click(ctx, EXISTING_DATE, 'transport'); // Lunch is already on from the fixture

      click(ctx, EXISTING_DATE, 'present');

      const row = dayRow(ctx.component, EXISTING_DATE);
      expect(row.present).toBe(false);
      expect(row.lunchSelected).toBe(false);
      expect(row.transportSelected).toBe(false);
      expect(checkbox(ctx, EXISTING_DATE, 'lunch').checked).toBe(false);
      expect(checkbox(ctx, EXISTING_DATE, 'lunch').disabled).toBe(true);
    });

    it('checking Present on an untouched day persists it even with nothing else selected', () => {
      const ctx = setup();

      click(ctx, UNTOUCHED_DATE, 'present');

      const row = dayRow(ctx.component, UNTOUCHED_DATE);
      expect(row.present).toBe(true);
      expect(row.persisted).toBe(true);
      expect(ctx.component.recordsToSave().map((r) => r.date)).toContain(UNTOUCHED_DATE);
    });

    it('unchecking Present again on a just-touched day leaves it persisted (all false)', () => {
      const ctx = setup();

      click(ctx, UNTOUCHED_DATE, 'present');
      click(ctx, UNTOUCHED_DATE, 'present');

      const row = dayRow(ctx.component, UNTOUCHED_DATE);
      expect(row.present).toBe(false);
      expect(row.persisted).toBe(true);
    });

    it('unchecking Present on an already-persisted day keeps it persisted, with Lunch cleared', () => {
      const ctx = setup();

      click(ctx, EXISTING_DATE, 'present');

      const row = dayRow(ctx.component, EXISTING_DATE);
      expect(row.persisted).toBe(true);
      expect(ctx.component.recordsToSave().map((r) => r.date)).toContain(EXISTING_DATE);
      expect(row.lunchSelected).toBe(false);
    });
  });

  describe('Lunch and Transport are independent', () => {
    it('checking Lunch does not touch Transport', () => {
      const ctx = setup();
      click(ctx, UNTOUCHED_DATE, 'present');

      click(ctx, UNTOUCHED_DATE, 'lunch');

      const row = dayRow(ctx.component, UNTOUCHED_DATE);
      expect(row.lunchSelected).toBe(true);
      expect(row.transportSelected).toBe(false);
    });

    it('unchecking Lunch leaves an already-checked Transport untouched', () => {
      const ctx = setup();
      click(ctx, EXISTING_DATE, 'transport'); // Lunch is on from the fixture

      click(ctx, EXISTING_DATE, 'lunch');

      const row = dayRow(ctx.component, EXISTING_DATE);
      expect(row.lunchSelected).toBe(false);
      expect(row.transportSelected).toBe(true);
    });

    it('checking Transport seeds its cost from the school price, persists the row, and does not touch Lunch', () => {
      const ctx = setup();
      click(ctx, UNTOUCHED_DATE, 'present');

      click(ctx, UNTOUCHED_DATE, 'transport');

      const row = dayRow(ctx.component, UNTOUCHED_DATE);
      expect(row.transportSelected).toBe(true);
      expect(row.transportCost).toBe(SCHOOL.transportPrice);
      expect(row.persisted).toBe(true);
      expect(row.lunchSelected).toBe(false);
    });

    it('unchecking Transport leaves an already-checked Lunch untouched', () => {
      const ctx = setup();
      click(ctx, EXISTING_DATE, 'transport');

      click(ctx, EXISTING_DATE, 'transport');

      const row = dayRow(ctx.component, EXISTING_DATE);
      expect(row.transportSelected).toBe(false);
      expect(row.lunchSelected).toBe(true);
    });

    it('re-checking a day keeps its already-seeded cost instead of re-seeding it', () => {
      const ctx = setup(); // the existing record has lunchCost 15, not the school price
      click(ctx, EXISTING_DATE, 'lunch'); // off
      click(ctx, EXISTING_DATE, 'lunch'); // on again

      expect(dayRow(ctx.component, EXISTING_DATE).lunchCost).toBe(15);
    });

    it('the "Both" checkbox reflects true only once both are independently checked', () => {
      const ctx = setup();

      expect(checkbox(ctx, EXISTING_DATE, 'both').checked).toBe(false); // Lunch only

      click(ctx, EXISTING_DATE, 'transport');

      expect(checkbox(ctx, EXISTING_DATE, 'both').checked).toBe(true);
    });

    it('"Both" checks Lunch and Transport together and seeds both costs', () => {
      const ctx = setup();
      click(ctx, UNTOUCHED_DATE, 'present');

      click(ctx, UNTOUCHED_DATE, 'both');

      const row = dayRow(ctx.component, UNTOUCHED_DATE);
      expect(row.lunchSelected).toBe(true);
      expect(row.transportSelected).toBe(true);
      expect(row.lunchCost).toBe(SCHOOL.lunchPrice);
      expect(row.transportCost).toBe(SCHOOL.transportPrice);
      expect(row.persisted).toBe(true);
      expect(checkbox(ctx, UNTOUCHED_DATE, 'lunch').checked).toBe(true);
      expect(checkbox(ctx, UNTOUCHED_DATE, 'transport').checked).toBe(true);
    });

    it('unchecking "Both" clears Lunch and Transport together', () => {
      const ctx = setup();
      click(ctx, UNTOUCHED_DATE, 'present');
      click(ctx, UNTOUCHED_DATE, 'both');

      click(ctx, UNTOUCHED_DATE, 'both');

      const row = dayRow(ctx.component, UNTOUCHED_DATE);
      expect(row.lunchSelected).toBe(false);
      expect(row.transportSelected).toBe(false);
    });
  });

  describe('totals', () => {
    it('sums only the selected costs across the month', () => {
      const ctx = setup();
      click(ctx, UNTOUCHED_DATE, 'present');

      click(ctx, UNTOUCHED_DATE, 'transport');

      expect(ctx.component.totalSelectedLunchCost()).toBe(15); // from the existing record
      expect(ctx.component.totalSelectedTransportCost()).toBe(SCHOOL.transportPrice);
      expect(ctx.component.grandTotal()).toBe(15 + SCHOOL.transportPrice);
      expect(ctx.fixture.nativeElement.textContent).toContain('25.00');
    });
  });

  describe('changing the month', () => {
    it('shows the new month\'s weekdays, with nothing persisted outside March', () => {
      const { component } = setup();

      component.monthForm.month().value.set('2024-04');

      expect(component.selectedMonth()).toBe('2024-04');
      expect(component.dayRows().length).toBe(getWeekdayDatesInMonth(2024, 4).length);
      expect(component.dayRows().every((r) => !r.persisted)).toBe(true);
    });

    it('keeps unsaved edits made in one month when switching to another and back', () => {
      const ctx = setup();
      click(ctx, UNTOUCHED_DATE, 'present');

      ctx.component.monthForm.month().value.set('2024-04');
      ctx.fixture.detectChanges();
      ctx.component.monthForm.month().value.set('2024-03');
      ctx.fixture.detectChanges();

      expect(dayRow(ctx.component, UNTOUCHED_DATE).present).toBe(true);
      expect(checkbox(ctx, UNTOUCHED_DATE, 'present').checked).toBe(true);
    });

    it('does not send the untouched days of a month that was only looked at', () => {
      const { component } = setup();

      component.monthForm.month().value.set('2024-04');

      expect(component.recordsToSave().map((r) => r.date)).toEqual([EXISTING_DATE]);
    });
  });

  describe('save', () => {
    it('sends the scholar id and the persisted records — without the form-only flag — and shows a success notification', () => {
      const { component, attendanceService, notificationService } = setup();

      component.save();

      expect(attendanceService.saveAttendance).toHaveBeenCalledWith(SCHOLAR.id, [
        makeExistingRecord(),
      ]);
      expect(component.recordsToSave()[0]).not.toHaveProperty('persisted');
      expect(notificationService.show).toHaveBeenCalledWith('Attendance saved successfully!');
      expect(component.isSaving()).toBe(false);
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('sends a day the user marked, and only that day, alongside the loaded records', () => {
      const ctx = setup();
      click(ctx, UNTOUCHED_DATE, 'present');
      click(ctx, UNTOUCHED_DATE, 'lunch');

      ctx.component.save();

      const saved = ctx.attendanceService.saveAttendance.mock.calls[0] as unknown as [
        string,
        AttendanceRecord[],
      ];
      expect(saved[1]).toEqual([
        makeExistingRecord(),
        {
          date: UNTOUCHED_DATE,
          present: true,
          lunchSelected: true,
          lunchCost: SCHOOL.lunchPrice,
          transportSelected: false,
          transportCost: 0,
        },
      ]);
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
        value: (row: { present: boolean }) => string;
      }[];
      const headers = columns.map((c) => c.header);
      expect(headers.indexOf('Present')).toBe(headers.indexOf('Date') + 1);

      const presentColumn = columns.find((c) => c.header === 'Present')!;
      expect(presentColumn.value({ present: true })).toBe('Yes');
      expect(presentColumn.value({ present: false })).toBe('No');
    });
  });
});
