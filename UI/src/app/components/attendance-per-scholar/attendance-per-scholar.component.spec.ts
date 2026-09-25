import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AttendancePerScholarComponent } from './attendance-per-scholar.component';
import { ScholarService } from '../../services/scholar.service';
import { SchoolService } from '../../services/school.service';
import { AttendanceService } from '../../services/attendance.service';
import { CsvExportService } from '../../services/csv-export.service';
import {
  DEFAULT_MONTH,
  getWeekdayDatesInMonth,
} from '../../utils/weekday-dates';
import type { Scholar } from '../../interfaces/scholar';
import type { School } from '../../interfaces/school';
import type { AttendanceRecord } from '../../interfaces/attendance-record';

const SCHOLAR: Scholar = {
  scholarId: 'scholar-1',
  firstName: 'Ana',
  lastName: 'Popescu',
  pickupSchedule: null,
  schoolId: 1,
  grade: 3,
  birthDate: '2016-01-01',
  motherFirstName: null,
  motherLastName: null,
  motherPhoneNumber: null,
  fatherFirstName: null,
  fatherLastName: null,
  fatherPhoneNumber: null,
};

const SCHOOL: School = {
  schoolId: 1,
  name: 'Test School',
  color: '#336699',
  lunchPrice: 15,
  transportPrice: 10,
};

const EXISTING_DATE = '2024-03-04';

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
  loadResult?: 'success' | 'scholar-error' | 'attendance-error';
  routeScholarId?: string | null;
}

function setup(options: SetupOptions = {}) {
  const notFound = new HttpErrorResponse({
    status: 404,
    error: {
      status: 404,
      title: 'Scholar not found.',
      detail: 'Scholar with ID scholar-1 not found.',
    },
  });
  const scholarService = {
    getScholar: vi.fn(() =>
      options.loadResult === 'scholar-error'
        ? throwError(() => notFound)
        : of(SCHOLAR),
    ),
  };
  const schoolService = { getSchool: vi.fn(() => of(SCHOOL)) };
  const saveAttendance = vi.fn(() =>
    options.saveResult === 'error' ? throwError(() => notFound) : of(undefined),
  );
  const attendanceService = {
    getAttendance: vi.fn(() =>
      options.loadResult === 'attendance-error'
        ? throwError(() => new HttpErrorResponse({ status: 500 }))
        : of(options.attendance ?? [makeExistingRecord()]),
    ),
    saveAttendance,
  };
  const csvExportService = { export: vi.fn() };

  TestBed.configureTestingModule({
    imports: [AttendancePerScholarComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: ScholarService, useValue: scholarService },
      { provide: SchoolService, useValue: schoolService },
      { provide: AttendanceService, useValue: attendanceService },
      { provide: CsvExportService, useValue: csvExportService },
    ],
  });

  const fixture: ComponentFixture<AttendancePerScholarComponent> =
    TestBed.createComponent(AttendancePerScholarComponent);
  const routeId =
    options.routeScholarId === undefined
      ? SCHOLAR.scholarId
      : options.routeScholarId;
  if (routeId !== null) fixture.componentRef.setInput('scholarId', routeId);
  fixture.detectChanges();

  return {
    fixture,
    component: fixture.componentInstance,
    scholarService,
    schoolService,
    attendanceService,
    csvExportService,
  };
}

function dayRow(component: AttendancePerScholarComponent, date: string) {
  const row = component.dayRows().find((r) => r.date === date);
  if (!row) throw new Error(`No day row for ${date}`);
  return row;
}

const UNTOUCHED_DATE = getWeekdayDatesInMonth(2024, 3).find(
  (d) => d !== EXISTING_DATE,
)!;

type Box = 'present' | 'lunch' | 'transport' | 'both';
const BOX_ORDER: Box[] = ['present', 'lunch', 'transport', 'both'];

type Setup = ReturnType<typeof setup>;

function checkbox(
  { fixture, component }: Setup,
  date: string,
  box: Box,
): HTMLInputElement {
  const index = component.dayRows().findIndex((r) => r.date === date);
  const rowEl = fixture.nativeElement.querySelectorAll(
    '.attendance-table__row',
  )[index];
  return rowEl.querySelectorAll('input[type="checkbox"]')[
    BOX_ORDER.indexOf(box)
  ];
}

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
      expect(fixture.nativeElement.textContent).toContain(
        'Loading attendance...',
      );
    });

    it('does nothing and calls no service when the route has no scholar id', () => {
      const { scholarService } = setup({ routeScholarId: null });
      expect(scholarService.getScholar).not.toHaveBeenCalled();
    });

    it('shows the load error, not the form, when the scholar cannot be loaded', () => {
      const { fixture, attendanceService } = setup({
        loadResult: 'scholar-error',
      });
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'Scholar with ID scholar-1 not found.',
      );
      expect(el.querySelector('table')).toBeNull();
      expect(attendanceService.getAttendance).not.toHaveBeenCalled();
    });

    it('shows the load error, not an empty (saveable) month, when attendance cannot be loaded', () => {
      const { fixture, component } = setup({ loadResult: 'attendance-error' });
      const el: HTMLElement = fixture.nativeElement;

      expect(component.loadError()).toBe(
        'Failed to load attendance (500). Please try again.',
      );
      expect(el.querySelector('table')).toBeNull();
      expect(el.textContent).not.toContain('Save changes');
    });

    it('defaults to the month of the latest existing attendance record', () => {
      const { component } = setup();
      expect(component.selectedMonth()).toBe('2024-03');
    });

    it('defaults to DEFAULT_MONTH when the scholar has no attendance yet', () => {
      const { component } = setup({ attendance: [] });

      expect(component.selectedMonth()).toBe(DEFAULT_MONTH);
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

    it("lists the month's weekdays in date order, whatever order the records arrived in", () => {
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
      expect(component.recordsToSave().map((r) => r.date)).toContain(
        UNTOUCHED_DATE,
      );
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
      click(ctx, EXISTING_DATE, 'transport');

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
      expect(ctx.component.recordsToSave().map((r) => r.date)).toContain(
        UNTOUCHED_DATE,
      );
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
      expect(ctx.component.recordsToSave().map((r) => r.date)).toContain(
        EXISTING_DATE,
      );
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
      click(ctx, EXISTING_DATE, 'transport');

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
      const ctx = setup();
      click(ctx, EXISTING_DATE, 'lunch');
      click(ctx, EXISTING_DATE, 'lunch');

      expect(dayRow(ctx.component, EXISTING_DATE).lunchCost).toBe(15);
    });

    it('the "Both" checkbox reflects true only once both are independently checked', () => {
      const ctx = setup();

      expect(checkbox(ctx, EXISTING_DATE, 'both').checked).toBe(false);

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

      expect(ctx.component.totalSelectedLunchCost()).toBe(15);
      expect(ctx.component.totalSelectedTransportCost()).toBe(
        SCHOOL.transportPrice,
      );
      expect(ctx.component.grandTotal()).toBe(15 + SCHOOL.transportPrice);
      expect(ctx.fixture.nativeElement.textContent).toContain('25,00 RON');
    });
  });

  describe('changing the month', () => {
    it("shows the new month's weekdays, with nothing persisted outside March", () => {
      const { component } = setup();

      component.monthForm.month().value.set('2024-04');

      expect(component.selectedMonth()).toBe('2024-04');
      expect(component.dayRows().length).toBe(
        getWeekdayDatesInMonth(2024, 4).length,
      );
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

      expect(component.recordsToSave().map((r) => r.date)).toEqual([
        EXISTING_DATE,
      ]);
    });
  });

  describe('save', () => {
    it('sends the scholar id and the persisted records — without the form-only flag', () => {
      const { component, attendanceService } = setup();

      component.save();

      expect(attendanceService.saveAttendance).toHaveBeenCalledWith(
        SCHOLAR.scholarId,
        [makeExistingRecord()],
      );
      expect(component.recordsToSave()[0]).not.toHaveProperty('persisted');
      expect(component.isSaving()).toBe(false);
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('sends a day the user marked, and only that day, alongside the loaded records', () => {
      const ctx = setup();
      click(ctx, UNTOUCHED_DATE, 'present');
      click(ctx, UNTOUCHED_DATE, 'lunch');

      ctx.component.save();

      const saved = ctx.attendanceService.saveAttendance.mock
        .calls[0] as unknown as [string, AttendanceRecord[]];
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

    it('shows the server-provided error inline on failure, keeping the unsaved edits', () => {
      const ctx = setup({ saveResult: 'error' });
      click(ctx, UNTOUCHED_DATE, 'present');

      ctx.component.save();
      ctx.fixture.detectChanges();

      expect(ctx.component.saveError()).toBe(
        'Scholar with ID scholar-1 not found.',
      );
      expect(
        ctx.fixture.nativeElement.querySelector('.app-alert')?.textContent,
      ).toContain('Scholar with ID scholar-1 not found.');
      expect(ctx.component.isSaving()).toBe(false);
      expect(ctx.component.hasUnsavedChanges()).toBe(true);
    });

    it('asks the browser to confirm a reload or tab close only while there are unsaved changes', () => {
      const ctx = setup();
      const clean = new Event('beforeunload', {
        cancelable: true,
      }) as BeforeUnloadEvent;
      ctx.component.onBeforeUnload(clean);
      expect(clean.defaultPrevented).toBe(false);

      click(ctx, UNTOUCHED_DATE, 'present');
      const dirty = new Event('beforeunload', {
        cancelable: true,
      }) as BeforeUnloadEvent;
      ctx.component.onBeforeUnload(dirty);
      expect(dirty.defaultPrevented).toBe(true);
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
