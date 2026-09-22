import { applyEach, disabled, schema } from '@angular/forms/signals';
import { AttendanceRecord } from '../../interfaces/attendance-record';
import { toDateOnly, toMonthString, weekdaysOfMonth } from '../../utils/weekday-dates';

export { toDateOnly, toMonthString, weekdaysOfMonth };

// One entry per day the attendance form knows about: every record loaded from
// the API, plus a stub for each weekday of every month the user has looked at.
// `persisted` says whether the day is part of what Save sends — true for loaded
// records, and latched to true the first time the user actually marks a day.
// An untouched stub is never sent to the API.
export interface AttendanceDay extends AttendanceRecord {
  persisted: boolean;
}

// The form is the whole list, as an immutable array: every edit replaces the
// array (Signal Forms writes through the model signal), so nothing is mutated
// in place and there are no shared record references to keep in sync.
export const attendanceFormSchema = schema<AttendanceDay[]>((days) => {
  applyEach(days, (day) => {
    // Present gates Lunch/Transport: neither can be selected on a day the
    // scholar wasn't there. (Unchecking Present also *clears* them — that's a
    // reaction to the change, so it lives in the component's onPresentChange.)
    disabled(day.lunchSelected, { when: ({ valueOf }) => !valueOf(day.present) });
    disabled(day.transportSelected, { when: ({ valueOf }) => !valueOf(day.present) });
  });
});

export function toAttendanceDays(records: AttendanceRecord[]): AttendanceDay[] {
  return records.map((record) => ({ ...record, persisted: true }));
}

// Picks the API's fields explicitly rather than spreading: Signal Forms tags the
// items of an array model with an internal symbol-keyed identity property, and a
// `...rest` spread would copy that into the payload.
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

// Returns `days` plus a not-yet-persisted stub for each weekday of `month` that
// has no entry yet (or `days` itself, unchanged, if none are missing).
export function withWeekdayStubs(days: AttendanceDay[], month: string): AttendanceDay[] {
  const known = new Set(days.map((day) => toDateOnly(day.date)));
  const stubs = weekdaysOfMonth(month)
    .filter((date) => !known.has(date))
    .map(
      (date): AttendanceDay => ({
        date,
        lunchCost: 0,
        transportCost: 0,
        present: false,
        lunchSelected: false,
        transportSelected: false,
        persisted: false,
      }),
    );
  return stubs.length === 0 ? days : [...days, ...stubs];
}
