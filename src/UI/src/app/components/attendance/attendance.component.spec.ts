import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AttendanceComponent } from './attendance.component';
import { ScholarService } from '../../services/scholar.service';
import { AttendanceService } from '../../services/attendance.service';
import { CsvExportService } from '../../services/csv-export.service';
import { Gender, Scholar } from '../../interfaces/scholar';
import { AttendanceRecord } from '../../interfaces/attendance-record';
import { ScholarAttendance } from '../../interfaces/scholar-attendance';
import { ScholarAttendanceRow } from './attendance-grid';

const buildScholar = (overrides: Partial<Scholar> = {}): Scholar => ({
  scholarId: 'scholar-1',
  firstName: 'Ana',
  lastName: 'Popescu',
  gender: Gender.Female,
  pickupSchedule: null,
  schoolId: 1,
  grade: 3,
  birthDate: '2018-05-01',
  motherFirstName: null,
  motherLastName: null,
  motherPhoneNumber: null,
  fatherFirstName: null,
  fatherLastName: null,
  fatherPhoneNumber: null,
  ...overrides,
});

const record = (
  date: string,
  overrides: Partial<AttendanceRecord> = {},
): AttendanceRecord => ({
  date,
  lunchCost: 15,
  transportCost: 10,
  present: true,
  lunchSelected: false,
  transportSelected: false,
  ...overrides,
});

const ANA = buildScholar();
const BOGDAN = buildScholar({ scholarId: 'scholar-2', firstName: 'Bogdan' });

// September 2026 (the default month) starts on a Tuesday and has 22 weekdays.
const ATTENDANCE: ScholarAttendance[] = [
  {
    scholarId: 'scholar-1',
    attendance: [
      record('2026-09-01', { lunchSelected: true }),
      record('2026-09-02', { transportSelected: true }),
      // Absent: the lunch choice must not count.
      record('2026-09-03', { present: false, lunchSelected: true }),
    ],
  },
  {
    scholarId: 'scholar-2',
    attendance: [record('2026-09-01'), record('2026-08-31')],
  },
];

async function setup(
  options: { scholars?: Scholar[]; loadError?: boolean } = {},
) {
  const exportCsv = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ScholarService,
        useValue: {
          getScholars: () =>
            options.loadError
              ? throwError(() => new HttpErrorResponse({ status: 500 }))
              : of(options.scholars ?? [BOGDAN, ANA]),
        },
      },
      {
        provide: AttendanceService,
        useValue: { getAllAttendance: () => of(ATTENDANCE) },
      },
      { provide: CsvExportService, useValue: { export: exportCsv } },
    ],
  });
  const fixture = TestBed.createComponent(AttendanceComponent);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const click = async (label: string) => {
    el.querySelector<HTMLButtonElement>(
      `button[aria-label="${label}"]`,
    )!.click();
    await fixture.whenStable();
  };
  return { fixture, el, exportCsv, click };
}

describe('AttendanceComponent', () => {
  it('shows a column per weekday of the month and a row per scholar, sorted by name', async () => {
    const { el } = await setup();
    const rows = el.querySelectorAll('tbody tr');

    expect(el.querySelectorAll('thead th').length).toBe(1 + 22);
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Ana Popescu');
    expect(rows[1].textContent).toContain('Bogdan Popescu');
  });

  it('lights up the present, lunch and transport badges of recorded days only', async () => {
    const { el } = await setup();
    const anaCells = el
      .querySelectorAll('tbody tr')[0]
      .querySelectorAll('.attendance-grid__day-cell');
    const active = (cell: Element) =>
      Array.from(cell.querySelectorAll('.badge--active')).map(
        (badge) => badge.className,
      );

    expect(active(anaCells[0])).toEqual([
      'badge badge--present badge--active',
      'badge badge--lunch badge--active',
    ]);
    expect(active(anaCells[1])).toEqual([
      'badge badge--present badge--active',
      'badge badge--transport badge--active',
    ]);
    expect(active(anaCells[3])).toEqual([]);
  });

  it('counts each day and totals the month, ignoring absent days and other months', async () => {
    const { fixture, el } = await setup();
    const component = fixture.componentInstance;

    expect(component.dailyCounts().present.slice(0, 3)).toEqual([2, 1, 0]);
    expect(component.dailyCounts().lunchSelected.slice(0, 3)).toEqual([
      1, 0, 0,
    ]);
    expect(
      el.querySelector('.attendance-grid__totals-cell')!.textContent,
    ).toMatch(/Present: 3\s.*Lunch:\s+1\s.*Transport:\s+1/s);
  });

  it('moves between months with the arrow buttons', async () => {
    const { fixture, el, click } = await setup();

    await click('Previous month');
    expect(fixture.componentInstance.selectedMonth()).toBe('2026-08');
    expect(el.querySelectorAll('thead th').length).toBe(1 + 21);
    expect(
      el.querySelector('.attendance-grid__totals-cell')!.textContent,
    ).toContain('Present: 1');

    await click('Next month');
    await click('Next month');
    expect(fixture.componentInstance.selectedMonth()).toBe('2026-10');
  });

  it('exports the grid of the selected month as CSV', async () => {
    const { el, exportCsv } = await setup();

    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Export CSV')!
      .click();

    const [prefix, columns, rows] = exportCsv.mock.calls[0] as [
      string,
      { header: string; value: (row: ScholarAttendanceRow) => string }[],
      ScholarAttendanceRow[],
    ];
    expect(prefix).toBe('attendance_2026-09');
    expect(columns.map((c) => c.header).slice(0, 3)).toEqual([
      'Scholar',
      '2026-09-01',
      '2026-09-02',
    ]);
    expect(columns.length).toBe(1 + 22);
    expect(columns[0].value(rows[0])).toBe('Ana Popescu');
    expect(columns[1].value(rows[0])).toBe('Present + Lunch');
    expect(columns[4].value(rows[0])).toBe('');
  });

  it('says so when there are no scholars', async () => {
    const { el } = await setup({ scholars: [] });

    expect(el.querySelector('tbody')!.textContent).toContain(
      'No scholars found.',
    );
  });

  it('shows the load error instead of the grid', async () => {
    const { el } = await setup({ loadError: true });

    expect(el.querySelector('[role="alert"]')!.textContent).toContain(
      'Failed to load attendance (500). Please try again.',
    );
    expect(el.querySelector('table')).toBeNull();
  });
});
