export function getWeekdayDatesInMonth(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const weekday = d.getDay();
    if (weekday === 0 || weekday === 6) continue;
    dates.push(
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    );
  }
  return dates;
}

export const DEFAULT_MONTH = '2026-09';
export const DEFAULT_YEAR = Number(DEFAULT_MONTH.substring(0, 4));

export const toMonthString = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export function weekdaysOfMonth(month: string): string[] {
  if (!month) return [];
  const [year, monthNumber] = month.split('-').map(Number);
  return getWeekdayDatesInMonth(year, monthNumber);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return toMonthString(new Date(year, monthNumber - 1 + delta, 1));
}

export function parseDateOnly(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}
