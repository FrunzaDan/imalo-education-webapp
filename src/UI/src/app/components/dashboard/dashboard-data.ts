import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { WEEK_DAYS, WeekDay } from '../../constants/week-days';

export interface TodayPickup {
  scholarId: string;
  name: string;
  time: string;
  schoolName: string;
  schoolColor: string;
}

export function todayWeekdayKey(today: Date): WeekDay | null {
  return WEEK_DAYS[today.getDay() - 1] ?? null;
}

export function todaysPickups(
  scholars: Scholar[],
  schools: School[],
  today: Date,
): TodayPickup[] {
  const dayKey = todayWeekdayKey(today);
  if (!dayKey) return [];

  const schoolById = new Map(
    schools.map((school) => [school.schoolId, school]),
  );

  const pickups: TodayPickup[] = [];
  for (const scholar of scholars) {
    const time = scholar.pickupSchedule?.[dayKey];
    if (!time) continue;
    const school =
      scholar.schoolId != null ? schoolById.get(scholar.schoolId) : undefined;
    pickups.push({
      scholarId: scholar.scholarId,
      name: `${scholar.firstName} ${scholar.lastName}`,
      time,
      schoolName: school?.name ?? 'Unknown',
      schoolColor: school?.color ?? '#a0a0a0',
    });
  }

  return pickups.sort((a, b) => a.time.localeCompare(b.time));
}

export interface UpcomingBirthday {
  scholarId: string;
  name: string;
  date: string;
  turningAge: number;
  daysUntil: number;
}

export function upcomingBirthdays(
  scholars: Scholar[],
  today: Date,
  withinDays = 30,
): UpcomingBirthday[] {
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const birthdays: UpcomingBirthday[] = [];
  for (const scholar of scholars) {
    if (!scholar.birthDate) continue;
    const [birthYear, birthMonth, birthDay] = scholar.birthDate
      .split('-')
      .map(Number);

    let next = new Date(todayMidnight.getFullYear(), birthMonth - 1, birthDay);
    if (next.getTime() < todayMidnight.getTime()) {
      next = new Date(
        todayMidnight.getFullYear() + 1,
        birthMonth - 1,
        birthDay,
      );
    }

    const daysUntil = Math.round(
      (next.getTime() - todayMidnight.getTime()) / 86_400_000,
    );
    if (daysUntil > withinDays) continue;

    birthdays.push({
      scholarId: scholar.scholarId,
      name: `${scholar.firstName} ${scholar.lastName}`,
      date: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(
        next.getDate(),
      ).padStart(2, '0')}`,
      turningAge: next.getFullYear() - birthYear,
      daysUntil,
    });
  }

  return birthdays.sort((a, b) => a.daysUntil - b.daysUntil);
}
