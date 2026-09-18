import { getWeekdayDatesInMonth } from './weekday-dates';

describe('getWeekdayDatesInMonth', () => {
  it('excludes Saturdays and Sundays', () => {
    // January 2024: Mon 1 .. Wed 31, contains full weekends to exclude.
    const dates = getWeekdayDatesInMonth(2024, 1);

    for (const date of dates) {
      const day = new Date(`${date}T00:00:00`).getDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    }
  });

  it('returns every weekday of the month, zero-padded YYYY-MM-DD', () => {
    // February 2024 (leap year): 29 days, Thu 1 .. Thu 29.
    const dates = getWeekdayDatesInMonth(2024, 2);

    expect(dates[0]).toBe('2024-02-01');
    expect(dates[dates.length - 1]).toBe('2024-02-29');
    expect(dates).toEqual([...new Set(dates)]); // no duplicates
    for (const date of dates) {
      expect(date).toMatch(/^2024-02-\d{2}$/);
    }
  });

  it('zero-pads single-digit months', () => {
    const dates = getWeekdayDatesInMonth(2024, 3);
    expect(dates.every((d) => d.startsWith('2024-03-'))).toBe(true);
  });

  it('handles a month that starts and ends mid-week (April 2024: Mon..Tue)', () => {
    const dates = getWeekdayDatesInMonth(2024, 4);
    // April 2024 has 30 days, 1st is a Monday, 30th is a Tuesday — 22 weekdays.
    expect(dates.length).toBe(22);
    expect(dates[0]).toBe('2024-04-01');
    expect(dates[dates.length - 1]).toBe('2024-04-30');
  });

  it('returns an empty-safe result and correct count for a month starting on Saturday', () => {
    // June 2024 starts on Saturday the 1st, ends Sunday the 30th — 20 weekdays.
    const dates = getWeekdayDatesInMonth(2024, 6);
    expect(dates.length).toBe(20);
    expect(dates[0]).toBe('2024-06-03'); // first Monday
  });
});
