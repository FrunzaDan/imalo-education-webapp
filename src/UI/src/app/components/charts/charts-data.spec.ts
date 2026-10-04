import { AttendanceRecord } from '../../interfaces/attendance-record';
import { Gender, Scholar } from '../../interfaces/scholar';
import { ScholarAttendance } from '../../interfaces/scholar-attendance';
import { School } from '../../interfaces/school';
import {
  AttendancePoint,
  attendanceCalendar,
  attendanceRate,
  averagePerDay,
  buildDailyPoints,
  buildMonthlyPoints,
  busiestDay,
  busiestPickup,
  busiestPoint,
  busiestWeekday,
  chargesByScholar,
  boysAndGirlsByClass,
  countByGrade,
  genderSlices,
  elapsedWeekdays,
  monthlyAveragePerDay,
  monthlyRevenue,
  monthlySeries,
  monthsOfYear,
  percentChange,
  pickupHeatmap,
  revenueMix,
  schoolCount,
  serviceMix,
  topSchools,
  totalOf,
  totalsByMonth,
  trailingMonths,
  weekdayAverages,
  yearOverYear,
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
  gender: Gender.Female,
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

const point = (key: string, present: number): AttendancePoint => ({
  key,
  label: key,
  present,
  lunchRevenue: 0,
  transportRevenue: 0,
  lunchDays: 0,
  transportDays: 0,
});

describe('buildDailyPoints', () => {
  it('returns one point per weekday of the month, labeled by day number', () => {
    const points = buildDailyPoints([], '2026-09');

    expect(points).toHaveLength(22);
    expect(points[0]).toEqual({ ...point('2026-09-01', 0), label: '1' });
  });

  it('sums presence, selected costs and services across every scholar', () => {
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
      lunchDays: 2,
      transportDays: 1,
    });
  });

  it('ignores records where the scholar was absent', () => {
    const points = buildDailyPoints(
      [attendanceOf(buildRecord({ present: false }))],
      '2026-09',
    );

    expect(points[0]).toMatchObject({ present: 0, lunchRevenue: 0 });
  });
});

describe('buildMonthlyPoints', () => {
  it('returns all 12 months of the year, keyed YYYY-MM', () => {
    const points = buildMonthlyPoints([], 2026);

    expect(points).toHaveLength(12);
    expect(points[0]).toMatchObject({ key: '2026-01', label: 'Jan' });
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

describe('attendance rate', () => {
  it('counts only the weekdays that have already happened', () => {
    expect(elapsedWeekdays('2026-09', new Date(2026, 8, 4))).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
    ]);
    expect(elapsedWeekdays('2026-10', new Date(2026, 8, 4))).toEqual([]);
  });

  it('is present days over scholars × elapsed weekdays', () => {
    expect(attendanceRate(6, 2, 4)).toBe(0.75);
  });

  it('is null before the month has started', () => {
    expect(attendanceRate(0, 5, 0)).toBeNull();
  });
});

describe('averagePerDay and weekdayAverages', () => {
  // 2026-09-07 is a Monday.
  const points = [
    point('2026-09-07', 4),
    point('2026-09-08', 0),
    point('2026-09-14', 6),
    point('2026-09-15', 3),
  ];

  it('averages over the days anyone came, so holidays are left out', () => {
    expect(averagePerDay(points)).toBeCloseTo(13 / 3);
    expect(averagePerDay([point('2026-09-07', 0)])).toBeNull();
  });

  it('averages each weekday separately, Monday to Friday', () => {
    const averages = weekdayAverages(points);

    expect(averages.map((a) => a.label)).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
    ]);
    expect(averages[0].value).toBe(5);
    expect(averages[1].value).toBe(3);
    expect(busiestWeekday(averages)?.label).toBe('Monday');
  });

  it('has no busiest weekday when nobody came', () => {
    expect(busiestWeekday(weekdayAverages([]))).toBeNull();
  });
});

describe('serviceMix and revenueMix', () => {
  it('sorts the days attended by what was ordered with them', () => {
    const mix = serviceMix(
      [
        attendanceOf(
          buildRecord(),
          buildRecord({ transportSelected: false }),
          buildRecord({ lunchSelected: false, transportSelected: false }),
          buildRecord({ present: false }),
          buildRecord({ date: '2026-10-01' }),
        ),
      ],
      '2026-09',
    );

    expect(mix).toEqual([
      { label: 'Lunch and transport', value: 1 },
      { label: 'Lunch only', value: 1 },
      { label: 'Transport only', value: 0 },
      { label: 'Neither', value: 1 },
    ]);
  });

  it('splits revenue into lunch and transport', () => {
    const points = buildDailyPoints([attendanceOf(buildRecord())], '2026-09');

    expect(revenueMix(points)).toEqual([
      { label: 'Lunch', value: 20 },
      { label: 'Transport', value: 10 },
    ]);
  });
});

describe('chargesByScholar', () => {
  it('ranks what each family owes for the month and tells namesakes apart', () => {
    const scholars = [
      buildScholar({ scholarId: 'a' }),
      buildScholar({ scholarId: 'b' }),
      buildScholar({ scholarId: 'c', firstName: 'Ion' }),
    ];
    const charges = chargesByScholar(
      [
        { scholarId: 'a', attendance: [buildRecord()] },
        {
          scholarId: 'b',
          attendance: [buildRecord(), buildRecord({ date: '2026-09-02' })],
        },
        { scholarId: 'c', attendance: [buildRecord({ present: false })] },
        { scholarId: 'gone', attendance: [buildRecord()] },
      ],
      scholars,
      '2026-09',
      8,
    );

    expect(charges).toEqual([
      { label: 'Ana Pop (2)', value: 60 },
      { label: 'Ana Pop', value: 30 },
    ]);
  });
});

describe('monthly totals', () => {
  const all = [
    attendanceOf(
      buildRecord({ date: '2025-08-04' }),
      buildRecord({ date: '2026-08-03' }),
      buildRecord({ date: '2026-08-03' }),
      buildRecord({ date: '2026-08-04' }),
      buildRecord({ date: '2026-08-05', present: false }),
    ),
  ];
  const totals = totalsByMonth(all);

  it('sums revenue and counts the distinct days anyone came', () => {
    expect(totals.get('2026-08')).toEqual({
      present: 3,
      revenue: 90,
      activeDays: 2,
    });
    expect(monthlyRevenue(totals.get('2026-08'))).toBe(90);
    expect(monthlyAveragePerDay(totals.get('2026-08'))).toBe(1.5);
    expect(monthlyAveragePerDay(undefined)).toBe(0);
  });

  it('lists trailing months oldest first, across a year boundary', () => {
    expect(trailingMonths('2026-02', 3)).toEqual([
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('builds a series with month labels and zero for empty months', () => {
    expect(
      monthlySeries(totals, ['2026-07', '2026-08'], monthlyRevenue),
    ).toEqual([
      { key: '2026-07', label: 'Jul', value: 0 },
      { key: '2026-08', label: 'Aug', value: 90 },
    ]);
  });

  it('leaves out the months still to come', () => {
    expect(monthsOfYear(2026, new Date(2026, 2, 15))).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
    expect(monthsOfYear(2025, new Date(2026, 2, 15))).toHaveLength(12);
  });

  it('compares the year with the same months of the year before', () => {
    expect(yearOverYear(totals, 2026, new Date(2026, 8, 1))).toEqual({
      previousYear: 2025,
      change: 2,
    });
    expect(yearOverYear(totals, 2025, new Date(2026, 8, 1))).toBeNull();
  });

  it('has no percent change without a previous value', () => {
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(15, 10)).toBe(0.5);
  });
});

describe('attendanceCalendar', () => {
  const calendar = attendanceCalendar(
    [
      attendanceOf(
        buildRecord({ date: '2026-01-01' }),
        buildRecord({ date: '2026-01-02', present: false }),
      ),
      { scholarId: 'b', attendance: [buildRecord({ date: '2026-01-01' })] },
    ],
    2026,
  );

  it('has a row per weekday and a column per week of the year', () => {
    expect(calendar.rowLabels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(calendar.columnLabels).toHaveLength(53);
    expect(calendar.cells.every((row) => row.length === 53)).toBe(true);
  });

  it('leaves days of the previous year blank and labels each month once', () => {
    // 1 January 2026 is a Thursday.
    expect(calendar.cells[0][0]).toBeNull();
    expect(calendar.cells[3][0]).toEqual({
      value: 2,
      title: 'Thu 1 Jan: 2 scholars present',
    });
    expect(calendar.cells[4][0]?.title).toBe('Fri 2 Jan: no attendance');
    expect(calendar.columnLabels.filter((l) => l !== '')).toEqual([
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
    ]);
  });

  it('finds the busiest day of the year', () => {
    expect(
      busiestDay(
        [
          attendanceOf(
            buildRecord({ date: '2026-03-02' }),
            buildRecord({ date: '2026-03-03' }),
          ),
          {
            scholarId: 'b',
            attendance: [buildRecord({ date: '2026-03-03' })],
          },
        ],
        2026,
      ),
    ).toEqual({ label: 'Tue 3 Mar', value: 2 });
    expect(busiestDay([], 2026)).toBeNull();
  });
});

describe('pickupHeatmap', () => {
  const schedule = (monday: string | null, friday: string | null) => ({
    monday,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday,
  });
  const scholars = [
    buildScholar({ pickupSchedule: schedule('13:00', '16:00') }),
    buildScholar({ pickupSchedule: schedule('13:00', null) }),
    buildScholar({ pickupSchedule: null }),
  ];

  it('counts scholars per weekday and pickup time, times in order', () => {
    const heatmap = pickupHeatmap(scholars);

    expect(heatmap.columnLabels).toEqual(['13:00', '16:00']);
    expect(heatmap.cells[0].map((c) => c?.value)).toEqual([2, 0]);
    expect(heatmap.cells[4].map((c) => c?.value)).toEqual([0, 1]);
    expect(heatmap.cells[0][0]?.title).toBe('Monday at 13:00: 2 scholars');
  });

  it('finds the rush hour', () => {
    expect(busiestPickup(scholars)).toEqual({
      day: 'Monday',
      time: '13:00',
      value: 2,
    });
    expect(busiestPickup([buildScholar()])).toBeNull();
  });
});

describe('countByGrade', () => {
  it('orders by grade, not by count, with Unassigned last', () => {
    expect(
      countByGrade([
        buildScholar({ grade: 2 }),
        buildScholar({ grade: 2 }),
        buildScholar({ grade: 1 }),
        buildScholar({ grade: null }),
      ]),
    ).toEqual([
      { label: 'Class 1', value: 1 },
      { label: 'Class 2', value: 2 },
      { label: 'Unassigned', value: 1 },
    ]);
  });

  it('omits Unassigned when every scholar has a grade', () => {
    expect(countByGrade([buildScholar()])).toEqual([
      { label: 'Class 1', value: 1 },
    ]);
  });
});

describe('genderSlices', () => {
  it('counts girls, boys and not declared, keeping empty slices', () => {
    expect(
      genderSlices([
        buildScholar({ gender: Gender.Male }),
        buildScholar({ gender: Gender.Male }),
        buildScholar({ gender: Gender.Female }),
      ]),
    ).toEqual([
      { label: 'Girls', value: 1 },
      { label: 'Boys', value: 2 },
      { label: 'Not declared', value: 0 },
    ]);
  });
});

describe('boysAndGirlsByClass', () => {
  it('splits each class into boys and girls, in class order with Unassigned last', () => {
    expect(
      boysAndGirlsByClass([
        buildScholar({ grade: null, gender: Gender.Male }),
        buildScholar({ grade: 3, gender: Gender.Female }),
        buildScholar({ grade: 1, gender: Gender.Male }),
        buildScholar({ grade: 1, gender: Gender.Female }),
        buildScholar({ grade: 1, gender: Gender.Female }),
      ]),
    ).toEqual([
      { key: '1', label: 'Class 1', value: 1, value2: 2 },
      { key: '3', label: 'Class 3', value: 0, value2: 1 },
      { key: 'Unassigned', label: 'Unassigned', value: 1, value2: 0 },
    ]);
  });

  it('leaves out scholars with no gender declared', () => {
    expect(
      boysAndGirlsByClass([
        buildScholar({ grade: 2, gender: Gender.NotDeclared }),
        buildScholar({ grade: 2, gender: Gender.Male }),
      ]),
    ).toEqual([{ key: '2', label: 'Class 2', value: 1, value2: 0 }]);
  });
});

describe('topSchools and schoolCount', () => {
  const schools: School[] = [
    {
      schoolId: 1,
      name: 'North School',
      color: '#000',
      lunchPrice: 20,
      transportPrice: 10,
    },
  ];
  const scholars = [
    buildScholar({ schoolId: 2 }),
    buildScholar({ schoolId: 1 }),
    buildScholar({ schoolId: 1 }),
    buildScholar({ schoolId: null }),
  ];

  it('ranks schools by headcount, names them, and keeps only the top ones', () => {
    expect(topSchools(scholars, schools, 2)).toEqual([
      { label: 'North School', value: 2 },
      { label: 'School 2', value: 1 },
    ]);
  });

  it('counts the distinct schools, not the unassigned', () => {
    expect(schoolCount(scholars)).toBe(2);
  });
});
