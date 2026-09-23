import { Component, inject, signal } from '@angular/core';
import { catchError, concatMap, from, map, of, switchMap, toArray } from 'rxjs';
import { ApiLoggerService } from '../../services/api-logger.service';
import { NotificationService } from '../../services/notification.service';
import { ScholarService } from '../../services/scholar.service';
import { AttendanceService } from '../../services/attendance.service';
import { SchoolService } from '../../services/school.service';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { AttendanceRecord } from '../../interfaces/attendance-record';
import { PickupSchedule } from '../../interfaces/pickup-schedule';
import { WEEK_DAYS } from '../../constants/week-days';
import { getWeekdayDatesInMonth } from '../../utils/weekday-dates';

const TEST_SCHOLAR_COUNT = 20;

const FIRST_NAMES = [
  'Andrei',
  'Maria',
  'Ion',
  'Elena',
  'Mihai',
  'Ioana',
  'Cristian',
  'Ana',
  'Alexandru',
  'Gabriela',
  'Florin',
  'Andreea',
  'Radu',
  'Simona',
  'George',
  'Cristina',
  'Dan',
  'Diana',
  'Vasile',
  'Larisa',
  'Adrian',
  'Mihaela',
  'Bogdan',
  'Roxana',
  'Cătălin',
  'Monica',
  'Stefan',
  'Alina',
  'Vlad',
  'Nicoleta',
  'Stefan',
  'Astrid',
  'Markus',
  'Ingrid',
  'Klaus',
  'Renate',
  'Thomas',
  'Sabine',
  'Hans',
  'Ursula',
];

const LAST_NAMES = [
  'Popescu',
  'Ionescu',
  'Popa',
  'Radu',
  'Dumitru',
  'Stan',
  'Gheorghe',
  'Constantin',
  'Marin',
  'Stoica',
  'Matei',
  'Ciobanu',
  'Munteanu',
  'Rusu',
  'Barbu',
  'Florea',
  'Nistor',
  'Toma',
  'Oprea',
  'Cristea',
  'Preda',
  'Dobre',
  'Dima',
  'Sârbu',
  'Neagu',
  'Enache',
  'Balan',
  'Diaconu',
  'Ilie',
  'Lupu',
  'Weber',
  'Schmidt',
  'Schneider',
  'Fischer',
  'Wagner',
  'Becker',
  'Hoffmann',
  'Schuster',
  'Klein',
  'Müller',
];

// Matches GanttChartComponent's own slot window (11:00-13:45, 15-minute
// steps), so randomly-generated schedules actually land on a slot and show
// up highlighted on the pickup-time chart instead of just sitting in data.
const PICKUP_TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let hour = 11; hour < 14; hour++) {
    for (let minutes = 0; minutes < 60; minutes += 15) {
      slots.push(
        `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
      );
    }
  }
  return slots;
})();

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Every calendar month from (startYear, startMonth) to (endYear, endMonth),
// inclusive on both ends.
function monthsInRange(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}

// 'YYYY-MM-DD' — matches Scholar.birthDate (the API's DateOnly).
function randomBirthdate(): string {
  const now = new Date();
  const end = new Date(
    now.getFullYear() - 5,
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const start = new Date(
    now.getFullYear() - 12,
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const date = new Date(start + Math.random() * (end - start));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function randomPickupSchedule(): PickupSchedule {
  // Every test scholar has a pickup time every weekday.
  return Object.fromEntries(
    WEEK_DAYS.map((day) => [day, pick(PICKUP_TIME_SLOTS)]),
  ) as PickupSchedule;
}

// A plausible-looking Romanian mobile number.
function randomPhoneNumber(): string {
  const prefix = pick(['072', '073', '074', '075', '076', '077', '078']);
  let digits = '';
  for (let i = 0; i < 7; i++)
    digits += Math.floor(Math.random() * 10).toString();
  return `${prefix}${digits}`;
}

interface RandomParent {
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
}

// A parent (name + phone), or all-null if this scholar has no parent
// recorded for that role — both mother and father are independently
// optional in the real data model too.
function randomParent(chance: number): RandomParent {
  if (Math.random() >= chance) {
    return { firstName: null, lastName: null, phoneNumber: null };
  }
  return {
    firstName: pick(FIRST_NAMES),
    lastName: pick(LAST_NAMES),
    phoneNumber: randomPhoneNumber(),
  };
}

@Component({
  selector: 'app-about',
  imports: [],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
})
export class AboutComponent {
  private readonly apiLoggerService = inject(ApiLoggerService);
  private readonly notificationService = inject(NotificationService);
  private readonly scholarService = inject(ScholarService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly schoolService = inject(SchoolService);

  readonly apiLoggingEnabled = this.apiLoggerService.enabled;
  readonly addingTestScholars = signal(false);

  toggleApiLogging(): void {
    this.apiLoggerService.toggle();
    this.notificationService.show(
      `API call logging turned ${this.apiLoggingEnabled() ? 'on' : 'off'}.`,
    );
  }

  addTestScholars(): void {
    if (this.addingTestScholars()) {
      return;
    }
    this.addingTestScholars.set(true);

    this.schoolService.getSchools().subscribe((schools) => {
      if (schools.length === 0) {
        this.addingTestScholars.set(false);
        this.notificationService.show(
          'No schools available, so no test scholars were added.',
          'error',
        );
        return;
      }

      const scholars = Array.from({ length: TEST_SCHOLAR_COUNT }, () =>
        this.buildRandomScholar(schools),
      );

      from(scholars)
        .pipe(
          concatMap((scholar) =>
            this.scholarService.createScholarSilently(scholar).pipe(
              switchMap((created) => {
                const school = schools.find(
                  (school) => school.schoolId === created.schoolId,
                );
                const attendance = this.buildRandomAttendance(school);
                return this.attendanceService
                  .saveAttendanceSilently(created.scholarId, attendance)
                  .pipe(
                    catchError((err) => {
                      console.warn(
                        `Created scholar ${created.scholarId} but failed to save its test attendance:`,
                        err,
                      );
                      return of(null);
                    }),
                  );
              }),
              map(() => true),
              catchError((err) => {
                console.warn('Failed to create a test scholar:', err);
                return of(false);
              }),
            ),
          ),
          toArray(),
        )
        .subscribe((results) => {
          this.addingTestScholars.set(false);
          const succeeded = results.filter(Boolean).length;
          const failed = results.length - succeeded;
          this.notificationService.show(
            failed === 0
              ? `Added ${succeeded} test scholars (with random schedules and attendance).`
              : `Added ${succeeded} test scholars; ${failed} could not be added.`,
            failed === 0 ? 'success' : 'error',
          );
        });
    });
  }

  private buildRandomScholar(schools: School[]): Scholar {
    // Every test scholar has at least one parent with contact info; the
    // other role is independently optional, same as the real data model.
    const mother = randomParent(1);
    const father = randomParent(0.5);
    return {
      scholarId: '00000000-0000-0000-0000-000000000000',
      firstName: pick(FIRST_NAMES),
      lastName: pick(LAST_NAMES),
      schoolId: pick(schools).schoolId,
      grade: randomInt(1, 4),
      birthDate: randomBirthdate(),
      pickupSchedule: randomPickupSchedule(),
      motherFirstName: mother.firstName,
      motherLastName: mother.lastName,
      motherPhoneNumber: mother.phoneNumber,
      fatherFirstName: father.firstName,
      fatherLastName: father.lastName,
      fatherPhoneNumber: father.phoneNumber,
    };
  }

  // Every month from July 2024 to September 2026 inclusive, most (not all)
  // weekdays, so the attendance dashboard's Charts page has real month- and
  // year-spanning trends to show right away instead of just the last couple
  // of months. No scholar ever gets Transport in July or August — school
  // holidays, no pickup runs.
  private buildRandomAttendance(
    school: School | undefined,
  ): AttendanceRecord[] {
    const lunchPrice = school?.lunchPrice ?? 15;
    const transportPrice = school?.transportPrice ?? 5;
    const months = monthsInRange(2024, 7, 2026, 9);

    const records: AttendanceRecord[] = [];
    for (const { year, month } of months) {
      const isSummerBreak = month === 7 || month === 8; // no transport in Jul/Aug

      for (const date of getWeekdayDatesInMonth(year, month)) {
        if (Math.random() >= 0.7) continue; // skip some days entirely

        // Lunch/Transport can only be selected while present, mirroring the
        // rule enforced in the UI and the API.
        const present = Math.random() < 0.9;
        const lunchSelected = present && Math.random() < 0.8;
        const transportSelected =
          !isSummerBreak && lunchSelected && Math.random() < 0.4;

        records.push({
          date,
          lunchCost: lunchSelected ? lunchPrice : 0,
          transportCost: transportSelected ? transportPrice : 0,
          present,
          lunchSelected,
          transportSelected,
        });
      }
    }
    return records;
  }
}
