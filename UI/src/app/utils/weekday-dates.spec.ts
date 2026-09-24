import { getWeekdayDatesInMonth } from './weekday-dates';

describe('getWeekdayDatesInMonth', () => {
  it('excludes Saturdays and Sundays', () => {
    const dates = getWeekdayDatesInMonth(2024, 1);

    for (const date of dates) {
      const day = new Date(`${date}T00:00:00`).getDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    }
  });

  it('returns every weekday of the month, zero-padded YYYY-MM-DD', () => {
    const dates = getWeekdayDatesInMonth(2024, 2);

    expect(dates[0]).toBe('2024-02-01');
    expect(dates[dates.length - 1]).toBe('2024-02-29');
    expect(dates).toEqual([...new Set(dates)]);
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
    expect(dates.length).toBe(22);
    expect(dates[0]).toBe('2024-04-01');
    expect(dates[dates.length - 1]).toBe('2024-04-30');
  });

  it('returns an empty-safe result and correct count for a month starting on Saturday', () => {
    const dates = getWeekdayDatesInMonth(2024, 6);
    expect(dates.length).toBe(20);
    expect(dates[0]).toBe('2024-06-03');
  });
});
