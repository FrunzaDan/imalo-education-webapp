import { AttendanceRecord } from '../../interfaces/attendance-record';
import { Scholar } from '../../interfaces/scholar';
import { ScholarAttendance } from '../../interfaces/scholar-attendance';
import { School } from '../../interfaces/school';
import {
  buildDailyPoints,
  buildMonthlyPoints,
  busiestPoint,
  ChartPoint,
  countByGrade,
  countBySchool,
  topCategory,
  totalOf,
} from './charts-data';

const buildRecord = (
  overrides: Partial<AttendanceRecord> = {},
): AttendanceRecord => ({
  date: '2026-09-01',
  lunchCost: 20,
  transportCost: 10,
  present: true,
  lunchSelected: true,
  transportSelected: true,
  ...overrides,
});

const buildScholar = (overrides: Partial<Scholar> = {}): Scholar => ({
  scholarId: 'scholar-1',
  firstName: 'Ana',
  lastName: 'Pop',
  pickupSchedule: null,
  schoolId: 1,
  grade: 1,
  birthDate: '2018-05-01',
  motherFirstName: null,
  motherLastName: null,
  motherPhoneNumber: null,
  fatherFirstName: null,
  fatherLastName: null,
  fatherPhoneNumber: null,
  ...overrides,
});

const attendanceOf = (...records: AttendanceRecord[]): ScholarAttendance => ({
  scholarId: 'scholar-1',
  attendance: records,
});

const point = (key: string, present: number): ChartPoint => ({
  key,
  label: key,
  present,
  lunchRevenue: 0,
  transportRevenue: 0,
});

describe('buildDailyPoints', () => {
  it('returns one point per weekday of the month, labeled by day number', () => {
    const points = buildDailyPoints([], '2026-09');

    expect(points).toHaveLength(22);
    expect(points[0]).toEqual({
      key: '2026-09-01',
      label: '1',
      present: 0,
      lunchRevenue: 0,
      transportRevenue: 0,
    });
  });

  it('sums presence and selected costs across every scholar for each day', () => {
    const points = buildDailyPoints(
      [
        attendanceOf(buildRecord({ date: '2026-09-01' })),
        attendanceOf(
          buildRecord({ date: '2026-09-01', transportSelected: false }),
        ),
      ],
      '2026-09',
    );

    expect(points[0]).toMatchObject({
      present: 2,
      lunchRevenue: 40,
      transportRevenue: 10,
    });
  });

  it('ignores records where the scholar was absent', () => {
    const points = buildDailyPoints(
      [attendanceOf(buildRecord({ present: false }))],
      '2026-09',
    );

    expect(points[0]).toMatchObject({
      present: 0,
      lunchRevenue: 0,
      transportRevenue: 0,
    });
  });
});

describe('buildMonthlyPoints', () => {
  it('returns all 12 months of the year, keyed YYYY-MM', () => {
    const points = buildMonthlyPoints([], 2026);

    expect(points).toHaveLength(12);
    expect(points[0].key).toBe('2026-01');
    expect(points[0].label).toBe('Jan');
    expect(points[11].key).toBe('2026-12');
  });

  it('buckets records by month and skips other years', () => {
    const points = buildMonthlyPoints(
      [
        attendanceOf(
          buildRecord({ date: '2026-09-01' }),
          buildRecord({ date: '2026-09-02' }),
          buildRecord({ date: '2025-09-01' }),
        ),
      ],
      2026,
    );

    expect(points[8]).toMatchObject({
      present: 2,
      lunchRevenue: 40,
      transportRevenue: 20,
    });
    expect(totalOf(points, 'present')).toBe(2);
  });

  it('keeps a first-of-month record in its own month', () => {
    const points = buildMonthlyPoints(
      [attendanceOf(buildRecord({ date: '2026-01-01' }))],
      2026,
    );

    expect(points[0].present).toBe(1);
  });
});

describe('busiestPoint', () => {
  it('returns the point with the highest present count', () => {
    const points = [point('a', 3), point('b', 7), point('c', 5)];

    expect(busiestPoint(points)?.key).toBe('b');
  });

  it('returns null when every point is zero', () => {
    expect(busiestPoint([point('a', 0), point('b', 0)])).toBeNull();
  });
});

describe('countByGrade', () => {
  it('orders by grade, not by count, with Unassigned last', () => {
    const counts = countByGrade([
      buildScholar({ grade: 2 }),
      buildScholar({ grade: 2 }),
      buildScholar({ grade: 1 }),
      buildScholar({ grade: null }),
    ]);

    expect(counts).toEqual([
      { key: '1', label: 'Class 1', value: 1 },
      { key: '2', label: 'Class 2', value: 2 },
      { key: 'unassigned', label: 'Unassigned', value: 1 },
    ]);
  });

  it('omits Unassigned when every scholar has a grade', () => {
    expect(countByGrade([buildScholar()]).map((c) => c.key)).toEqual(['1']);
  });
});

describe('countBySchool', () => {
  const schools: School[] = [
    {
      schoolId: 1,
      name: 'North School',
      color: '#000',
      lunchPrice: 20,
      transportPrice: 10,
    },
  ];

  it('ranks schools by headcount and names them from the school list', () => {
    const counts = countBySchool(
      [
        buildScholar({ schoolId: 2 }),
        buildScholar({ schoolId: 1 }),
        buildScholar({ schoolId: 1 }),
        buildScholar({ schoolId: null }),
      ],
      schools,
    );

    expect(counts).toEqual([
      { key: '1', label: 'North School', value: 2 },
      { key: '2', label: 'School 2', value: 1 },
      { key: 'unassigned', label: 'Unassigned', value: 1 },
    ]);
  });
});

describe('topCategory', () => {
  it('returns the highest-count entry', () => {
    expect(
      topCategory([
        { key: 'a', label: 'A', value: 1 },
        { key: 'b', label: 'B', value: 4 },
      ])?.key,
    ).toBe('b');
  });

  it('returns null for an empty list', () => {
    expect(topCategory([])).toBeNull();
  });
});
