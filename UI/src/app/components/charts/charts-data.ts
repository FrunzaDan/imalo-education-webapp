import { AttendanceRecord } from '../../interfaces/attendance-record';
import { Scholar } from '../../interfaces/scholar';
import { ScholarAttendance } from '../../interfaces/scholar-attendance';
import { School } from '../../interfaces/school';
import { weekdaysOfMonth } from '../../utils/weekday-dates';

export interface ChartPoint {
  key: string;
  label: string;
  present: number;
  lunchRevenue: number;
  transportRevenue: number;
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function flattenRecords(
  allAttendance: ScholarAttendance[],
): AttendanceRecord[] {
  return allAttendance.flatMap((sa) => sa.attendance);
}

function aggregate(
  records: AttendanceRecord[],
): Omit<ChartPoint, 'key' | 'label'> {
  let present = 0;
  let lunchRevenue = 0;
  let transportRevenue = 0;

  for (const record of records) {
    if (!record.present) continue;
    present++;
    if (record.lunchSelected) lunchRevenue += record.lunchCost;
    if (record.transportSelected) transportRevenue += record.transportCost;
  }

  return { present, lunchRevenue, transportRevenue };
}

export function buildDailyPoints(
  allAttendance: ScholarAttendance[],
  month: string,
): ChartPoint[] {
  const dates = weekdaysOfMonth(month);
  const byDate = new Map<string, AttendanceRecord[]>();

  for (const record of flattenRecords(allAttendance)) {
    const bucket = byDate.get(record.date);
    if (bucket) bucket.push(record);
    else byDate.set(record.date, [record]);
  }

  return dates.map((date) => ({
    key: date,
    label: String(Number(date.substring(8, 10))),
    ...aggregate(byDate.get(date) ?? []),
  }));
}

export function buildMonthlyPoints(
  allAttendance: ScholarAttendance[],
  year: number,
): ChartPoint[] {
  const byMonth = new Map<number, AttendanceRecord[]>();

  for (const record of flattenRecords(allAttendance)) {
    const [recordYear, recordMonth] = record.date.split('-').map(Number);
    if (recordYear !== year) continue;
    const bucket = byMonth.get(recordMonth);
    if (bucket) bucket.push(record);
    else byMonth.set(recordMonth, [record]);
  }

  return MONTH_LABELS.map((label, index) => ({
    key: `${year}-${String(index + 1).padStart(2, '0')}`,
    label,
    ...aggregate(byMonth.get(index + 1) ?? []),
  }));
}

export const totalOf = (
  points: ChartPoint[],
  field: keyof Omit<ChartPoint, 'key' | 'label'>,
): number => points.reduce((sum, p) => sum + p[field], 0);

export function busiestPoint(points: ChartPoint[]): ChartPoint | null {
  return points.reduce<ChartPoint | null>((best, p) => {
    if (p.present === 0) return best;
    if (!best || p.present > best.present) return p;
    return best;
  }, null);
}

export const toYear = (date: Date): number => date.getFullYear();

export const shiftYear = (year: number, delta: number): number => year + delta;

export interface CategoryCount {
  key: string;
  label: string;
  value: number;
}

export function countByGrade(scholars: Scholar[]): CategoryCount[] {
  const counts = new Map<number, number>();
  let unassigned = 0;

  for (const scholar of scholars) {
    if (scholar.grade === null || scholar.grade === undefined) {
      unassigned++;
      continue;
    }
    counts.set(scholar.grade, (counts.get(scholar.grade) ?? 0) + 1);
  }

  const result = [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([grade, value]) => ({
      key: String(grade),
      label: `Class ${grade}`,
      value,
    }));

  if (unassigned > 0)
    result.push({ key: 'unassigned', label: 'Unassigned', value: unassigned });
  return result;
}

export function countBySchool(
  scholars: Scholar[],
  schools: School[],
): CategoryCount[] {
  const nameById = new Map(
    schools.map((school) => [school.schoolId, school.name]),
  );
  const counts = new Map<number | 'unassigned', number>();

  for (const scholar of scholars) {
    const key = scholar.schoolId ?? 'unassigned';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, value]) => ({
      key: String(key),
      label:
        key === 'unassigned'
          ? 'Unassigned'
          : (nameById.get(key) ?? `School ${key}`),
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

export function topCategory(counts: CategoryCount[]): CategoryCount | null {
  return counts.reduce<CategoryCount | null>(
    (best, c) => (!best || c.value > best.value ? c : best),
    null,
  );
}
