import { AttendanceRecord } from '../../interfaces/attendance-record';
import { Scholar } from '../../interfaces/scholar';
import { ScholarAttendance } from '../../interfaces/scholar-attendance';
import { weekdaysOfMonth } from '../../utils/weekday-dates';

// A day's status for one scholar, or null when there is no record for that
// day at all (never marked — same as a marked-absent day, but rendered the
// same either way: `present` false in both cases is what the template checks).
export interface AttendanceCell {
  present: boolean;
  lunchSelected: boolean;
  transportSelected: boolean;
}

export interface ScholarAttendanceRow {
  scholarId: string;
  scholarName: string;
  cells: (AttendanceCell | null)[];
}

// One row per scholar (name-sorted), one cell per weekday of `month`, aligned
// index-for-index with weekdaysOfMonth(month).
export function buildScholarRows(
  scholars: Scholar[],
  allAttendance: ScholarAttendance[],
  month: string,
): ScholarAttendanceRow[] {
  const dates = weekdaysOfMonth(month);
  const recordsByScholarId = new Map(
    allAttendance.map((sa) => [sa.scholarId, indexByDate(sa.attendance)]),
  );

  return scholars
    .map((scholar) => {
      const recordsByDate = recordsByScholarId.get(scholar.id);
      return {
        scholarId: scholar.id,
        scholarName: `${scholar.firstName} ${scholar.lastName}`,
        cells: dates.map((date) => toCell(recordsByDate?.get(date))),
      };
    })
    .sort((a, b) => a.scholarName.localeCompare(b.scholarName));
}

function indexByDate(records: AttendanceRecord[]): Map<string, AttendanceRecord> {
  return new Map(records.map((record) => [record.date, record]));
}

function toCell(record: AttendanceRecord | undefined): AttendanceCell | null {
  if (!record) return null;
  return {
    present: record.present,
    lunchSelected: record.lunchSelected,
    transportSelected: record.transportSelected,
  };
}

// What a cell means in plain text, for CSV export.
export function cellLabel(cell: AttendanceCell | null): string {
  if (!cell?.present) return '';
  const parts = ['Present'];
  if (cell.lunchSelected) parts.push('Lunch');
  if (cell.transportSelected) parts.push('Transport');
  return parts.join(' + ');
}

// One count per weekday column, across every scholar row — the footer's
// per-day summary lines.
export interface DailyAttendanceCounts {
  present: number[];
  lunchSelected: number[];
  transportSelected: number[];
}

export function countsByDay(rows: ScholarAttendanceRow[], dayCount: number): DailyAttendanceCounts {
  const present = new Array(dayCount).fill(0);
  const lunchSelected = new Array(dayCount).fill(0);
  const transportSelected = new Array(dayCount).fill(0);

  for (const row of rows) {
    row.cells.forEach((cell, index) => {
      if (!cell?.present) return;
      present[index]++;
      if (cell.lunchSelected) lunchSelected[index]++;
      if (cell.transportSelected) transportSelected[index]++;
    });
  }

  return { present, lunchSelected, transportSelected };
}

export const sum = (counts: number[]): number => counts.reduce((a, b) => a + b, 0);
