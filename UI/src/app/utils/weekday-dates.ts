// Every Monday-Friday date in the given year/month, formatted 'YYYY-MM-DD'.
// Weekday-only to match PickUpSchedule (no Saturday/Sunday) — attendance and
// pickup scheduling are school-day concepts throughout this app.
export function getWeekdayDatesInMonth(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const weekday = d.getDay();
    if (weekday === 0 || weekday === 6) continue; // skip Sat/Sun
    dates.push(
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    );
  }
  return dates;
}

// The month every month/year picker opens on ('YYYY-MM'), instead of the
// current real-world month — matches the last month the test-data seeder
// (AboutComponent) generates attendance for.
export const DEFAULT_MONTH = '2026-09';
export const DEFAULT_YEAR = Number(DEFAULT_MONTH.substring(0, 4));

// 'YYYY-MM', the value format of <input type="month">.
export const toMonthString = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

// The weekdays ('YYYY-MM-DD') of a 'YYYY-MM' month — matches PickUpSchedule's
// Mon-Fri convention. Empty for an empty/invalid month.
export function weekdaysOfMonth(month: string): string[] {
  if (!month) return [];
  const [year, monthNumber] = month.split('-').map(Number);
  return getWeekdayDatesInMonth(year, monthNumber);
}

// Shifts a 'YYYY-MM' month string by `delta` months (negative for earlier).
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return toMonthString(new Date(year, monthNumber - 1 + delta, 1));
}

// Parses a 'YYYY-MM-DD' string into a local-time Date, day-for-day — unlike
// `new Date(dateOnlyString)`, which the spec parses as UTC midnight and can
// display a day early/late once formatted in a timezone behind/ahead of UTC.
export function parseDateOnly(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}
