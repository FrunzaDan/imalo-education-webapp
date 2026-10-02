import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { ScholarService } from '../../services/scholar.service';
import { SchoolService } from '../../services/school.service';
import { AttendanceService } from '../../services/attendance.service';
import { GlobalAuditLogService } from '../../services/global-audit-log.service';
import { Gender, Scholar } from '../../interfaces/scholar';
import type { School } from '../../interfaces/school';
import { AttendanceRecord } from '../../interfaces/attendance-record';
import { ScholarAttendance } from '../../interfaces/scholar-attendance';
import { GlobalAuditLogEntry } from '../../interfaces/global-audit-log-entry';
import { PickupSchedule } from '../../interfaces/pickup-schedule';

const SCHOOL: School = {
  schoolId: 1,
  name: 'Scoala 1',
  color: '#123456',
  lunchPrice: 15,
  transportPrice: 10,
};

const thursday = (time: string): PickupSchedule => ({
  monday: null,
  tuesday: null,
  wednesday: null,
  thursday: time,
  friday: null,
});

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

// "Today" is Thursday 10 September 2026: 8 weekdays of the month have elapsed.
const TODAY = new Date(2026, 8, 10, 10, 0);

const SCHOLARS = [
  buildScholar({
    pickupSchedule: thursday('12:30'),
    birthDate: '2018-09-15',
  }),
  buildScholar({
    scholarId: 'scholar-2',
    firstName: 'Bogdan',
    schoolId: null,
    pickupSchedule: thursday('11:45'),
    birthDate: '2019-03-01',
  }),
  buildScholar({
    scholarId: 'scholar-3',
    firstName: 'Cara',
    birthDate: '2017-09-10',
  }),
];

const ATTENDANCE: ScholarAttendance[] = [
  {
    scholarId: 'scholar-1',
    attendance: [
      record('2026-09-01', { lunchSelected: true, transportSelected: true }),
      record('2026-09-02', { lunchSelected: true }),
      record('2026-09-03', { present: false, lunchSelected: true }),
      record('2026-08-31', { lunchSelected: true }),
    ],
  },
  { scholarId: 'scholar-2', attendance: [record('2026-09-01')] },
];

const ENTRIES: GlobalAuditLogEntry[] = [
  {
    scholarAuditLogId: 2,
    scholarId: 'scholar-1',
    scholarFirstName: 'Ana',
    scholarLastName: 'Popescu',
    actionType: 'Edited',
    details: null,
    occurredAt: '2026-09-09T08:00:00Z',
  },
  {
    scholarAuditLogId: 1,
    scholarId: 'scholar-9',
    scholarFirstName: null,
    scholarLastName: null,
    actionType: 'Deleted',
    details: null,
    occurredAt: '2026-09-08T08:00:00Z',
  },
];

async function setup(
  options: {
    today?: Date;
    loadError?: boolean;
    entries?: GlobalAuditLogEntry[];
  } = {},
) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(options.today ?? TODAY);
  const bindAllAuditLog = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ScholarService,
        useValue: {
          getScholars: () =>
            options.loadError
              ? throwError(() => new HttpErrorResponse({ status: 500 }))
              : of(SCHOLARS),
        },
      },
      { provide: SchoolService, useValue: { getSchools: () => of([SCHOOL]) } },
      {
        provide: AttendanceService,
        useValue: { getAllAttendance: () => of(ATTENDANCE) },
      },
      {
        provide: GlobalAuditLogService,
        useValue: {
          entries: signal(options.entries ?? ENTRIES),
          bindAllAuditLog,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(DashboardComponent);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const panel = (title: string) =>
    Array.from(el.querySelectorAll('section')).find((s) =>
      s.querySelector('h2')!.textContent!.includes(title),
    )!;
  return { fixture, el, panel, bindAllAuditLog };
}

describe('DashboardComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the scholar and school counts, attendance rate and revenue of this month', async () => {
    const { el } = await setup();
    const tiles = Array.from(el.querySelectorAll('.stat-tile__value')).map(
      (tile) => tile.textContent!.trim(),
    );

    // 3 present days out of 3 scholars × 8 weekdays = 12.5%, rounded.
    // Revenue counts only present days of September: 15 + 10 + 15.
    expect(tiles).toEqual(['3', '1', '13%', '40,00 RON']);
  });

  it("lists today's pickups by time, with the school (or Unknown)", async () => {
    const { panel } = await setup();
    const items = panel("Today's Pickups").querySelectorAll('li');

    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Bogdan Popescu');
    expect(items[0].textContent).toContain('Unknown');
    expect(items[0].textContent).toContain('11:45');
    expect(items[1].textContent).toContain('Ana Popescu');
    expect(items[1].textContent).toContain('Scoala 1');
    expect(items[1].textContent).toContain('12:30');
  });

  it('says there are no pickups at the weekend', async () => {
    const { panel } = await setup({ today: new Date(2026, 8, 12, 10, 0) });

    expect(panel("Today's Pickups").textContent).toContain(
      "It's the weekend — no pickups scheduled.",
    );
  });

  it('lists the birthdays of the next 30 days, soonest first', async () => {
    const { panel } = await setup();
    const items = panel('Upcoming birthdays').querySelectorAll('li');

    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Cara Popescu');
    expect(items[0].textContent).toContain('turns 9');
    expect(items[0].textContent).toContain('Today');
    expect(items[1].textContent).toContain('Ana Popescu');
    expect(items[1].textContent).toContain('turns 8');
    expect(items[1].textContent).toContain('in 5 days');
  });

  it('shows the 5 latest audit entries, linking only scholars that still exist', async () => {
    const { panel, bindAllAuditLog } = await setup();
    const items = panel('Recent activity').querySelectorAll('li');

    expect(bindAllAuditLog.mock.calls[0][0]()).toEqual({
      pageNumber: 1,
      pageSize: 5,
    });
    expect(items[0].querySelector('a')!.textContent).toContain('Ana Popescu');
    expect(items[1].querySelector('a')).toBeNull();
    expect(items[1].textContent).toContain('(deleted scholar scholar-9)');
  });

  it('says so when nothing has been recorded yet', async () => {
    const { panel } = await setup({ entries: [] });

    expect(panel('Recent activity').textContent).toContain(
      'No recorded actions yet.',
    );
  });

  it('shows the load error instead of the dashboard', async () => {
    const { el } = await setup({ loadError: true });

    expect(el.querySelector('[role="alert"]')!.textContent).toContain(
      'Failed to load the dashboard (500). Please try again.',
    );
    expect(el.querySelector('.dashboard-stats')).toBeNull();
  });
});
