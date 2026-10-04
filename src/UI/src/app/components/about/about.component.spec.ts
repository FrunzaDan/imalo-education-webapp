import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AttendanceRecord } from '../../interfaces/attendance-record';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { ApiLoggerService } from '../../services/api-logger.service';
import { AttendanceService } from '../../services/attendance.service';
import { NotificationService } from '../../services/notification.service';
import { ScholarService } from '../../services/scholar.service';
import { SchoolService } from '../../services/school.service';
import { AboutComponent } from './about.component';

describe('AboutComponent', () => {
  let toggle: ReturnType<typeof vi.fn>;
  let enabled: ReturnType<typeof signal<boolean>>;
  let show: ReturnType<typeof vi.fn>;
  let getSchools: ReturnType<typeof vi.fn>;
  let createScholarSilently: ReturnType<typeof vi.fn>;
  let saveAttendanceSilently: ReturnType<typeof vi.fn>;

  const schools: School[] = [
    {
      schoolId: 1,
      name: 'Scoala 1',
      color: '#ff0000',
      lunchPrice: 20,
      transportPrice: 7,
    },
    {
      schoolId: 2,
      name: 'Scoala 2',
      color: '#00ff00',
      lunchPrice: 18,
      transportPrice: 6,
    },
  ];

  const createComponent = () => {
    toggle = vi.fn();
    enabled = signal(true);
    show = vi.fn();
    getSchools = vi.fn().mockReturnValue(of(schools));
    let n = 0;
    createScholarSilently = vi.fn((scholar: Scholar) =>
      of({ ...scholar, scholarId: `scholar-${n++}` }),
    );
    saveAttendanceSilently = vi.fn().mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        { provide: ApiLoggerService, useValue: { enabled, toggle } },
        { provide: NotificationService, useValue: { show } },
        { provide: SchoolService, useValue: { getSchools } },
        { provide: ScholarService, useValue: { createScholarSilently } },
        { provide: AttendanceService, useValue: { saveAttendanceSilently } },
      ],
    });
    return TestBed.runInInjectionContext(() => new AboutComponent());
  };

  const createdScholars = () =>
    createScholarSilently.mock.calls.map(([scholar]) => scholar as Scholar);

  const savedAttendance = () =>
    saveAttendanceSilently.mock.calls as [string, AttendanceRecord[]][];

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  describe('toggleApiLogging', () => {
    it('delegates to the service and shows the resulting state', () => {
      const component = createComponent();

      component.toggleApiLogging();

      expect(toggle).toHaveBeenCalled();
      expect(show).toHaveBeenCalledWith('API call logging turned on.');
    });

    it('reflects "off" when the service reports disabled', () => {
      const component = createComponent();
      enabled.set(false);

      component.toggleApiLogging();

      expect(show).toHaveBeenCalledWith('API call logging turned off.');
    });
  });

  describe('addTestScholars', () => {
    it('adds 20 scholars, saves attendance for each and reports success', () => {
      const component = createComponent();

      component.addTestScholars();

      expect(createScholarSilently).toHaveBeenCalledTimes(20);
      expect(savedAttendance().map(([id]) => id)).toEqual(
        Array.from({ length: 20 }, (_, i) => `scholar-${i}`),
      );
      expect(show).toHaveBeenCalledWith(
        'Added 20 test scholars (with random schedules and attendance).',
        'success',
      );
      expect(component.addingTestScholars()).toBe(false);
    });

    it('builds scholars the API accepts: a known school, grade 1-4, a 5-12 year old, a mother to call', () => {
      const component = createComponent();

      component.addTestScholars();

      for (const scholar of createdScholars()) {
        expect([1, 2]).toContain(scholar.schoolId);
        expect(scholar.grade).toBeGreaterThanOrEqual(1);
        expect(scholar.grade).toBeLessThanOrEqual(4);
        expect(scholar.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const age =
          (Date.now() - new Date(scholar.birthDate).getTime()) /
          (365.25 * 86_400_000);
        expect(age).toBeGreaterThanOrEqual(5 - 0.01);
        expect(age).toBeLessThanOrEqual(12 + 0.01);
        expect(scholar.motherFirstName).toBeTruthy();
        expect(scholar.motherPhoneNumber).toMatch(/^07[2-8]\d{7}$/);
      }
    });

    it('gives every weekday a pickup time between 11:00 and 13:45, on the quarter hour', () => {
      const component = createComponent();

      component.addTestScholars();

      for (const { pickupSchedule } of createdScholars()) {
        expect(Object.keys(pickupSchedule!)).toEqual([
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
        ]);
        for (const time of Object.values(pickupSchedule!)) {
          expect(time).toMatch(/^1[1-3]:(00|15|30|45)$/);
        }
      }
    });

    it("charges the scholar's own school prices, and never transport without lunch or in the summer", () => {
      const component = createComponent();

      component.addTestScholars();

      const scholars = createdScholars();
      for (const [scholarId, records] of savedAttendance()) {
        const index = Number(scholarId.split('-')[1]);
        const school = schools.find(
          (s) => s.schoolId === scholars[index].schoolId,
        )!;
        expect(records.length).toBeGreaterThan(0);
        for (const record of records) {
          const day = new Date(`${record.date}T00:00:00`).getDay();
          expect(day).not.toBe(0);
          expect(day).not.toBe(6);
          expect(record.date >= '2024-07-01').toBe(true);
          expect(record.date <= '2026-09-30').toBe(true);
          expect(record.lunchCost).toBe(
            record.lunchSelected ? school.lunchPrice : 0,
          );
          expect(record.transportCost).toBe(
            record.transportSelected ? school.transportPrice : 0,
          );
          if (!record.present) expect(record.lunchSelected).toBe(false);
          if (record.transportSelected) {
            expect(record.lunchSelected).toBe(true);
            expect(record.date.slice(5, 7)).not.toMatch(/^0[78]$/);
          }
        }
      }
    });

    it('adds nobody and says why when there are no schools', () => {
      const component = createComponent();
      getSchools.mockReturnValue(of([]));

      component.addTestScholars();

      expect(createScholarSilently).not.toHaveBeenCalled();
      expect(show).toHaveBeenCalledWith(
        'No schools available, so no test scholars were added.',
        'error',
      );
      expect(component.addingTestScholars()).toBe(false);
    });

    it('carries on past a scholar that could not be added and reports it', () => {
      const component = createComponent();
      createScholarSilently.mockImplementationOnce(() =>
        throwError(() => new Error('400')),
      );

      component.addTestScholars();

      expect(createScholarSilently).toHaveBeenCalledTimes(20);
      expect(saveAttendanceSilently).toHaveBeenCalledTimes(19);
      expect(show).toHaveBeenCalledWith(
        'Added 19 test scholars; 1 could not be added.',
        'error',
      );
    });

    it('still counts a scholar as added when only its attendance fails to save', () => {
      const component = createComponent();
      saveAttendanceSilently.mockReturnValue(
        throwError(() => new Error('500')),
      );

      component.addTestScholars();

      expect(show).toHaveBeenCalledWith(
        'Added 20 test scholars (with random schedules and attendance).',
        'success',
      );
    });

    it('ignores a second click while a run is in progress', () => {
      const component = createComponent();
      const schools$ = new Subject<School[]>();
      getSchools.mockReturnValue(schools$);

      component.addTestScholars();
      component.addTestScholars();
      expect(component.addingTestScholars()).toBe(true);
      schools$.next(schools);

      expect(getSchools).toHaveBeenCalledTimes(1);
      expect(createScholarSilently).toHaveBeenCalledTimes(20);
      expect(component.addingTestScholars()).toBe(false);
    });
  });
});
