import { applyEach, disabled, schema } from '@angular/forms/signals';
import { AttendanceRecord } from '../../interfaces/attendance-record';
import { toMonthString, weekdaysOfMonth } from '../../utils/weekday-dates';

export { toMonthString, weekdaysOfMonth };

export interface AttendanceDay extends AttendanceRecord {
  persisted: boolean;
}

export const attendanceFormSchema = schema<AttendanceDay[]>((days) => {
  applyEach(days, (day) => {
    disabled(day.lunchSelected, {
      when: ({ valueOf }) => !valueOf(day.present),
    });
    disabled(day.transportSelected, {
      when: ({ valueOf }) => !valueOf(day.present),
    });
  });
});

export function toAttendanceDays(records: AttendanceRecord[]): AttendanceDay[] {
  return records.map((record) => ({ ...record, persisted: true }));
}

export function toAttendanceRecords(days: AttendanceDay[]): AttendanceRecord[] {
  return days
    .filter((day) => day.persisted)
    .map((day) => ({
      date: day.date,
      lunchCost: day.lunchCost,
      transportCost: day.transportCost,
      present: day.present,
      lunchSelected: day.lunchSelected,
      transportSelected: day.transportSelected,
    }));
}

export function withWeekdayStubs(
  days: AttendanceDay[],
  month: string,
): AttendanceDay[] {
  const known = new Set(days.map((day) => day.date));
  const stubs = weekdaysOfMonth(month)
    .filter((date) => !known.has(date))
    .map((date): AttendanceDay => ({
      date,
      lunchCost: 0,
      transportCost: 0,
      present: false,
      lunchSelected: false,
      transportSelected: false,
      persisted: false,
    }));
  return stubs.length === 0 ? days : [...days, ...stubs];
}
