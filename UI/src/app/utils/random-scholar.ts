import { WEEK_DAYS } from '../constants/week-days';
import { AttendanceRecord } from '../interfaces/attendance-record';
import { PickupSchedule } from '../interfaces/pickup-schedule';
import { Gender, Scholar } from '../interfaces/scholar';
import { School } from '../interfaces/school';
import { getWeekdayDatesInMonth } from './weekday-dates';

// Test scholars are primary-school children with the names given today, in
// Romanian and German families, and parents who usually share their surname.

const BOY_NAMES = [
  'Luca',
  'Matei',
  'David',
  'Tudor',
  'Rareș',
  'Ianis',
  'Eric',
  'Sebastian',
  'Mihnea',
  'Filip',
  'Albert',
  'Victor',
  'Toma',
  'Vlad',
  'Ștefan',
  'Leon',
  'Noah',
  'Paul',
  'Emil',
  'Felix',
  'Jonas',
  'Maximilian',
  'Tobias',
  'Elias',
];

const GIRL_NAMES = [
  'Sofia',
  'Ilinca',
  'Daria',
  'Eva',
  'Mara',
  'Irina',
  'Amelia',
  'Alesia',
  'Bianca',
  'Carla',
  'Ana',
  'Maria',
  'Ioana',
  'Natalia',
  'Anastasia',
  'Emma',
  'Mia',
  'Lena',
  'Hannah',
  'Clara',
  'Lea',
  'Anna',
  'Johanna',
  'Marie',
];

const FATHER_NAMES = [
  'Andrei',
  'Mihai',
  'Alexandru',
  'Cristian',
  'Bogdan',
  'Radu',
  'Marius',
  'Adrian',
  'Florin',
  'Ionuț',
  'Cosmin',
  'Răzvan',
  'Markus',
  'Thomas',
  'Klaus',
  'Stefan',
  'Michael',
  'Andreas',
];

const MOTHER_NAMES = [
  'Ioana',
  'Andreea',
  'Elena',
  'Cristina',
  'Alina',
  'Roxana',
  'Mihaela',
  'Raluca',
  'Oana',
  'Diana',
  'Simona',
  'Laura',
  'Astrid',
  'Ingrid',
  'Sabine',
  'Julia',
  'Katharina',
  'Stefanie',
];

const LAST_NAMES = [
  'Popescu',
  'Ionescu',
  'Popa',
  'Dumitru',
  'Stan',
  'Gheorghe',
  'Constantin',
  'Stoica',
  'Munteanu',
  'Barbu',
  'Nistor',
  'Toma',
  'Oprea',
  'Enache',
  'Bălan',
  'Diaconu',
  'Lupu',
  'Voicu',
  'Georgescu',
  'Radulescu',
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

// School ends between 11:00 and 13:45; most children leave on the hour or
// half hour, so those slots are picked more often.
const PICKUP_TIME_SLOTS = (() => {
  const slots: { time: string; weight: number }[] = [];
  for (let hour = 11; hour < 14; hour++) {
    for (let minutes = 0; minutes < 60; minutes += 15) {
      slots.push({
        time: `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        weight: minutes % 30 === 0 ? 3 : 1,
      });
    }
  }
  return slots;
})();

const ATTENDANCE_MONTHS = {
  from: { year: 2024, month: 7 },
  to: { year: 2026, month: 9 },
};

export const GENDER_WEIGHTS: readonly { gender: Gender; weight: number }[] = [
  { gender: Gender.Male, weight: 46 },
  { gender: Gender.Female, weight: 46 },
  { gender: Gender.NotDeclared, weight: 8 },
];

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function pickWeighted<T extends { weight: number }>(values: readonly T[]): T {
  const total = values.reduce((sum, value) => sum + value.weight, 0);
  let roll = Math.random() * total;
  for (const value of values) {
    roll -= value.weight;
    if (roll < 0) return value;
  }
  return values[values.length - 1];
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

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

// 6½ to 11 years old; the grade follows the age (7 → 1st, 10 → 4th), with
// the odd child a year ahead or behind.
function randomAgeAndGrade(today: Date): { birthDate: string; grade: number } {
  const age = randomBetween(6.5, 11);
  const birth = new Date(today.getTime() - age * 365.25 * 86_400_000);
  const drift = Math.random() < 0.15 ? pick([-1, 1]) : 0;
  const grade = Math.min(4, Math.max(1, Math.floor(age) - 6 + drift));
  return { birthDate: toIsoDate(birth), grade };
}

// Most days at the child's usual time; some children vary more than others.
function randomPickupSchedule(): PickupSchedule {
  const usual = pickWeighted(PICKUP_TIME_SLOTS).time;
  const variability = randomBetween(0, 0.5);
  return Object.fromEntries(
    WEEK_DAYS.map((day) => [
      day,
      Math.random() < variability
        ? pickWeighted(PICKUP_TIME_SLOTS).time
        : usual,
    ]),
  ) as PickupSchedule;
}

// Generated records carry this word after their names, so they are easy to
// tell apart from real ones and to find again.
const TEST_SUFFIX = 'Test';

export function randomGender(): Gender {
  return pickWeighted(GENDER_WEIGHTS).gender;
}

function firstNameFor(gender: Gender): string {
  if (gender === Gender.Male) return pick(BOY_NAMES);
  if (gender === Gender.Female) return pick(GIRL_NAMES);
  return pick(Math.random() < 0.5 ? BOY_NAMES : GIRL_NAMES);
}

function randomPhoneNumber(): string {
  const prefix = pick(['072', '073', '074', '075', '076', '077', '078']);
  let digits = '';
  for (let i = 0; i < 7; i++)
    digits += Math.floor(Math.random() * 10).toString();
  return `${prefix}${digits}`;
}

export function buildRandomScholar(
  schools: School[],
  today = new Date(),
): Scholar {
  const familyName = pick(LAST_NAMES);
  const hasFather = Math.random() < 0.8;
  // Without a father on record, the child carries the mother's surname.
  const motherName =
    !hasFather || Math.random() < 0.75
      ? familyName
      : Math.random() < 0.5
        ? `${pick(LAST_NAMES)}-${familyName}`
        : pick(LAST_NAMES);
  const { birthDate, grade } = randomAgeAndGrade(today);
  const gender = randomGender();

  return {
    scholarId: '00000000-0000-0000-0000-000000000000',
    firstName: firstNameFor(gender) + TEST_SUFFIX,
    lastName: familyName + TEST_SUFFIX,
    gender,
    schoolId: pick(schools).schoolId,
    grade,
    birthDate,
    pickupSchedule: randomPickupSchedule(),
    motherFirstName: pick(MOTHER_NAMES) + TEST_SUFFIX,
    motherLastName: motherName + TEST_SUFFIX,
    motherPhoneNumber: randomPhoneNumber(),
    fatherFirstName: hasFather ? pick(FATHER_NAMES) + TEST_SUFFIX : null,
    fatherLastName: hasFather ? familyName + TEST_SUFFIX : null,
    fatherPhoneNumber:
      hasFather && Math.random() < 0.85 ? randomPhoneNumber() : null,
  };
}

// Each child has its own habits: how often it comes, how often it stays for
// lunch and how often it takes the bus home. Transport only comes with lunch
// and never in the summer break.
export function buildRandomAttendance(
  school: School | undefined,
): AttendanceRecord[] {
  const lunchPrice = school?.lunchPrice ?? 15;
  const transportPrice = school?.transportPrice ?? 5;
  const attendanceRate = randomBetween(0.35, 0.95);
  const absenceRate = randomBetween(0, 0.2);
  const lunchRate = randomBetween(0.3, 1);
  const transportRate = Math.random() < 0.4 ? 0 : randomBetween(0.2, 0.9);
  const { from, to } = ATTENDANCE_MONTHS;

  const records: AttendanceRecord[] = [];
  for (const { year, month } of monthsInRange(
    from.year,
    from.month,
    to.year,
    to.month,
  )) {
    const isSummerBreak = month === 7 || month === 8;

    for (const date of getWeekdayDatesInMonth(year, month)) {
      if (Math.random() >= attendanceRate) continue;

      const present = Math.random() >= absenceRate;
      const lunchSelected = present && Math.random() < lunchRate;
      const transportSelected =
        !isSummerBreak && lunchSelected && Math.random() < transportRate;

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
