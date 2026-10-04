import { AttendanceRecord } from '../../interfaces/attendance-record';
import { Gender, Scholar } from '../../interfaces/scholar';
import { ScholarAttendance } from '../../interfaces/scholar-attendance';
import { School } from '../../interfaces/school';
import { WEEK_DAYS } from '../../constants/week-days';
import {
  ChartPoint,
  LabelValue,
  rankTotals,
  totalsByLabel,
} from '../../utils/chart-stats';
import {
  parseDateOnly,
  shiftMonth,
  toMonthString,
  weekdaysOfMonth,
} from '../../utils/weekday-dates';
import { BarChartPoint } from './bar-chart/bar-chart.component';
import { HeatmapData } from './heatmap/heatmap.component';

export interface AttendancePoint {
  key: string;
  label: string;
  present: number;
  lunchRevenue: number;
  transportRevenue: number;
  lunchDays: number;
  transportDays: number;
}

type Totals = Omit<AttendancePoint, 'key' | 'label'>;

interface MonthTotals {
  present: number;
  revenue: number;
  activeDays: number;
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

export const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function flattenRecords(
  allAttendance: ScholarAttendance[],
): AttendanceRecord[] {
  return allAttendance.flatMap((sa) => sa.attendance);
}

function aggregate(records: AttendanceRecord[]): Totals {
  const totals: Totals = {
    present: 0,
    lunchRevenue: 0,
    transportRevenue: 0,
    lunchDays: 0,
    transportDays: 0,
  };

  for (const record of records) {
    if (!record.present) continue;
    totals.present++;
    if (record.lunchSelected) {
      totals.lunchRevenue += record.lunchCost;
      totals.lunchDays++;
    }
    if (record.transportSelected) {
      totals.transportRevenue += record.transportCost;
      totals.transportDays++;
    }
  }

  return totals;
}

function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string | null,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (key === null) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

export const toIsoDate = (date: Date): string =>
  `${toMonthString(date)}-${String(date.getDate()).padStart(2, '0')}`;

export function buildDailyPoints(
  allAttendance: ScholarAttendance[],
  month: string,
): AttendancePoint[] {
  const byDate = groupBy(flattenRecords(allAttendance), (r) => r.date);

  return weekdaysOfMonth(month).map((date) => ({
    key: date,
    label: String(Number(date.substring(8, 10))),
    ...aggregate(byDate.get(date) ?? []),
  }));
}

export function buildMonthlyPoints(
  allAttendance: ScholarAttendance[],
  year: number,
): AttendancePoint[] {
  const prefix = `${year}-`;
  const byMonth = groupBy(flattenRecords(allAttendance), (r) =>
    r.date.startsWith(prefix) ? r.date.substring(0, 7) : null,
  );

  return MONTH_LABELS.map((label, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`;
    return { key, label, ...aggregate(byMonth.get(key) ?? []) };
  });
}

export const totalOf = (
  points: AttendancePoint[],
  field: keyof Totals,
): number => points.reduce((sum, p) => sum + p[field], 0);

export const revenueOf = (points: AttendancePoint[]): number =>
  totalOf(points, 'lunchRevenue') + totalOf(points, 'transportRevenue');

export function busiestPoint(
  points: AttendancePoint[],
): AttendancePoint | null {
  return points.reduce<AttendancePoint | null>((best, p) => {
    if (p.present === 0) return best;
    if (!best || p.present > best.present) return p;
    return best;
  }, null);
}

export const shiftYear = (year: number, delta: number): number => year + delta;

/** The month's weekdays up to and including today; days to come don't count yet. */
export function elapsedWeekdays(month: string, today: Date): string[] {
  const todayIso = toIsoDate(today);
  return weekdaysOfMonth(month).filter((date) => date <= todayIso);
}

/** Share of possible scholar-days used: present / (scholars × weekdays so far). */
export function attendanceRate(
  present: number,
  scholarCount: number,
  weekdayCount: number,
): number | null {
  const capacity = scholarCount * weekdayCount;
  return capacity > 0 ? present / capacity : null;
}

/** Average scholars present on the days anyone came (holidays don't drag it down). */
export function averagePerDay(points: AttendancePoint[]): number | null {
  const activeDays = points.filter((p) => p.present > 0);
  return activeDays.length > 0
    ? totalOf(activeDays, 'present') / activeDays.length
    : null;
}

export function weekdayAverages(points: AttendancePoint[]): LabelValue[] {
  const byWeekday = groupBy(
    points.filter((p) => p.present > 0),
    (p) => WEEKDAY_NAMES[parseDateOnly(p.key).getDay() - 1],
  );
  return WEEKDAY_NAMES.map((label) => {
    const days = byWeekday.get(label) ?? [];
    return {
      label,
      value: days.length > 0 ? totalOf(days, 'present') / days.length : 0,
    };
  });
}

export function busiestWeekday(averages: LabelValue[]): LabelValue | null {
  return averages.reduce<LabelValue | null>(
    (best, day) =>
      day.value > 0 && (!best || day.value > best.value) ? day : best,
    null,
  );
}

export function serviceMix(
  allAttendance: ScholarAttendance[],
  month: string,
): LabelValue[] {
  const counts = [0, 0, 0, 0];
  for (const record of flattenRecords(allAttendance)) {
    if (!record.present || !record.date.startsWith(month)) continue;
    const lunch = record.lunchSelected;
    const transport = record.transportSelected;
    counts[lunch && transport ? 0 : lunch ? 1 : transport ? 2 : 3]++;
  }
  return [
    { label: 'Lunch and transport', value: counts[0] },
    { label: 'Lunch only', value: counts[1] },
    { label: 'Transport only', value: counts[2] },
    { label: 'Neither', value: counts[3] },
  ];
}

export function revenueMix(points: AttendancePoint[]): LabelValue[] {
  return [
    { label: 'Lunch', value: totalOf(points, 'lunchRevenue') },
    { label: 'Transport', value: totalOf(points, 'transportRevenue') },
  ];
}

function scholarNames(scholars: Scholar[]): Map<string, string> {
  const seen = new Map<string, number>();
  return new Map(
    scholars.map((scholar) => {
      const name = `${scholar.firstName} ${scholar.lastName}`;
      const count = (seen.get(name) ?? 0) + 1;
      seen.set(name, count);
      return [scholar.scholarId, count === 1 ? name : `${name} (${count})`];
    }),
  );
}

/** The biggest `limit` totals. No "Other" bar: it would dwarf the named ones. */
function topOnly(totals: Map<string, number>, limit: number): LabelValue[] {
  return rankTotals(totals, totals.size, '').slice(0, limit);
}

/** What each scholar's family owes for the month, biggest first. */
export function chargesByScholar(
  allAttendance: ScholarAttendance[],
  scholars: Scholar[],
  month: string,
  limit: number,
): LabelValue[] {
  const names = scholarNames(scholars);
  const totals = new Map<string, number>();

  for (const { scholarId, attendance } of allAttendance) {
    const name = names.get(scholarId);
    if (!name) continue;
    const { lunchRevenue, transportRevenue } = aggregate(
      attendance.filter((r) => r.date.startsWith(month)),
    );
    if (lunchRevenue + transportRevenue > 0)
      totals.set(name, lunchRevenue + transportRevenue);
  }

  return topOnly(totals, limit);
}

export function totalsByMonth(
  allAttendance: ScholarAttendance[],
): Map<string, MonthTotals> {
  const byMonth = groupBy(flattenRecords(allAttendance), (r) =>
    r.date.substring(0, 7),
  );
  return new Map(
    [...byMonth.entries()].map(([month, records]) => {
      const present = records.filter((r) => r.present);
      const totals = aggregate(present);
      return [
        month,
        {
          present: totals.present,
          revenue: totals.lunchRevenue + totals.transportRevenue,
          activeDays: new Set(present.map((r) => r.date)).size,
        },
      ];
    }),
  );
}

export function monthlyRevenue(totals: MonthTotals | undefined): number {
  return totals?.revenue ?? 0;
}

export function monthlyAveragePerDay(totals: MonthTotals | undefined): number {
  return totals && totals.activeDays > 0
    ? totals.present / totals.activeDays
    : 0;
}

/** The `count` months ending with `endMonth`, oldest first. */
export function trailingMonths(endMonth: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    shiftMonth(endMonth, i - count + 1),
  );
}

export function percentChange(
  current: number,
  previous: number,
): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}

/** The year's months up to the current one: months still to come are left out, not drawn as zero. */
export function monthsSoFar<T extends { key: string }>(
  points: T[],
  today: Date,
): T[] {
  const currentMonth = toMonthString(today);
  return points.filter((p) => p.key <= currentMonth);
}

export function monthlySeries(
  totals: Map<string, MonthTotals>,
  months: string[],
  valueFn: (totals: MonthTotals | undefined) => number,
): ChartPoint[] {
  return months.map((key) => ({
    key,
    label: MONTH_LABELS[Number(key.substring(5, 7)) - 1],
    value: valueFn(totals.get(key)),
  }));
}

export function monthsOfYear(year: number, today: Date): string[] {
  const currentMonth = toMonthString(today);
  return MONTH_LABELS.map(
    (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`,
  ).filter((month) => month <= currentMonth);
}

/** This year's revenue against the same months of last year. */
export function yearOverYear(
  totals: Map<string, MonthTotals>,
  year: number,
  today: Date,
): { previousYear: number; change: number } | null {
  const months = monthsOfYear(year, today);
  const sum = (y: number) =>
    months.reduce(
      (acc, m) => acc + monthlyRevenue(totals.get(`${y}${m.substring(4)}`)),
      0,
    );
  const change = percentChange(sum(year), sum(year - 1));
  return change === null ? null : { previousYear: year - 1, change };
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/** One cell per weekday of the year (weeks as columns), valued by scholars present. */
export function attendanceCalendar(
  allAttendance: ScholarAttendance[],
  year: number,
): HeatmapData {
  const present = new Map<string, number>();
  for (const record of flattenRecords(allAttendance)) {
    if (record.present && record.date.startsWith(`${year}-`))
      present.set(record.date, (present.get(record.date) ?? 0) + 1);
  }

  const jan1 = new Date(year, 0, 1);
  const firstMonday = new Date(
    year,
    0,
    1 - ((jan1.getDay() + 6) % 7),
  ).getTime();
  const weekCount = Math.ceil(
    (new Date(year, 11, 31).getTime() - firstMonday + MS_PER_DAY) /
      (7 * MS_PER_DAY),
  );

  const columnLabels: string[] = [];
  const cells = WEEKDAY_NAMES.map(() => [] as HeatmapData['cells'][number]);
  let lastMonth = -1;

  for (let week = 0; week < weekCount; week++) {
    let label = '';
    for (let day = 0; day < 5; day++) {
      const date = new Date(firstMonday);
      date.setDate(date.getDate() + week * 7 + day);
      if (date.getFullYear() !== year) {
        cells[day].push(null);
        continue;
      }
      if (!label && date.getMonth() !== lastMonth) {
        lastMonth = date.getMonth();
        label = MONTH_LABELS[lastMonth];
      }
      const value = present.get(toIsoDate(date)) ?? 0;
      cells[day].push({
        value,
        title: `${formatDay(date)}: ${value > 0 ? `${plural(value, 'scholar')} present` : 'no attendance'}`,
      });
    }
    columnLabels.push(label);
  }

  return {
    rowLabels: WEEKDAY_NAMES.map((name) => name.substring(0, 3)),
    columnLabels,
    cells,
  };
}

export function busiestDay(
  allAttendance: ScholarAttendance[],
  year: number,
): { label: string; value: number } | null {
  const counts = totalsByLabel(
    flattenRecords(allAttendance).filter(
      (r) => r.present && r.date.startsWith(`${year}-`),
    ),
    (r) => r.date,
  );
  let best: { date: string; value: number } | null = null;
  for (const [date, value] of counts) {
    if (
      !best ||
      value > best.value ||
      (value === best.value && date < best.date)
    )
      best = { date, value };
  }
  return best
    ? { label: formatDay(parseDateOnly(best.date)), value: best.value }
    : null;
}

/** Weekday × pickup time, valued by how many scholars are picked up then. */
export function pickupHeatmap(scholars: Scholar[]): HeatmapData {
  const times = new Set<string>();
  for (const scholar of scholars)
    for (const day of WEEK_DAYS) {
      const time = scholar.pickupSchedule?.[day];
      if (time) times.add(time);
    }
  const columns = [...times].sort();

  return {
    rowLabels: WEEKDAY_NAMES.map((name) => name.substring(0, 3)),
    columnLabels: columns,
    cells: WEEK_DAYS.map((day, row) =>
      columns.map((time) => {
        const value = scholars.filter(
          (s) => s.pickupSchedule?.[day] === time,
        ).length;
        return {
          value,
          title: `${WEEKDAY_NAMES[row]} at ${time}: ${plural(value, 'scholar')}`,
        };
      }),
    ),
  };
}

export function busiestPickup(
  scholars: Scholar[],
): { day: string; time: string; value: number } | null {
  const { cells, columnLabels } = pickupHeatmap(scholars);
  let best: { day: string; time: string; value: number } | null = null;
  for (let row = 0; row < cells.length; row++)
    for (let column = 0; column < cells[row].length; column++) {
      const value = cells[row][column]?.value ?? 0;
      if (value > 0 && (!best || value > best.value))
        best = {
          day: WEEKDAY_NAMES[row],
          time: columnLabels[column],
          value,
        };
    }
  return best;
}

export function countByGrade(scholars: Scholar[]): LabelValue[] {
  const counts = totalsByLabel(
    scholars.filter((s) => s.grade !== null && s.grade !== undefined),
    (s) => String(s.grade),
  );
  const unassigned =
    scholars.length - [...counts.values()].reduce((a, b) => a + b, 0);

  const result = [...counts.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([grade, value]) => ({ label: `Class ${grade}`, value }));

  if (unassigned > 0) result.push({ label: 'Unassigned', value: unassigned });
  return result;
}

const GENDER_SLICES: readonly [Gender, string][] = [
  [Gender.Female, 'Girls'],
  [Gender.Male, 'Boys'],
  [Gender.NotDeclared, 'Not declared'],
];

export function genderSlices(scholars: Scholar[]): LabelValue[] {
  return GENDER_SLICES.map(([gender, label]) => ({
    label,
    value: scholars.filter((s) => s.gender === gender).length,
  }));
}

// Boys (first series) and girls (second series) in each class, in class
// order. Scholars with no gender declared are left out.
export function boysAndGirlsByClass(scholars: Scholar[]): BarChartPoint[] {
  const byClass = new Map<string, { boys: number; girls: number }>();
  for (const scholar of scholars) {
    const key =
      scholar.grade === null || scholar.grade === undefined
        ? 'Unassigned'
        : String(scholar.grade);
    const counts = byClass.get(key) ?? { boys: 0, girls: 0 };
    if (scholar.gender === Gender.Male) counts.boys++;
    if (scholar.gender === Gender.Female) counts.girls++;
    byClass.set(key, counts);
  }

  return [...byClass.entries()]
    .sort(([a], [b]) =>
      a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : Number(a) - Number(b),
    )
    .map(([key, { boys, girls }]) => ({
      key,
      label: key === 'Unassigned' ? key : `Class ${key}`,
      value: boys,
      value2: girls,
    }));
}

export function topSchools(
  scholars: Scholar[],
  schools: School[],
  limit: number,
): LabelValue[] {
  const nameById = new Map(
    schools.map((school) => [school.schoolId, school.name]),
  );
  return topOnly(
    totalsByLabel(scholars, (s) =>
      s.schoolId === null
        ? 'Unassigned'
        : (nameById.get(s.schoolId) ?? `School ${s.schoolId}`),
    ),
    limit,
  );
}

export function schoolCount(scholars: Scholar[]): number {
  return new Set(scholars.map((s) => s.schoolId).filter((id) => id !== null))
    .size;
}
