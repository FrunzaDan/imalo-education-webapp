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
