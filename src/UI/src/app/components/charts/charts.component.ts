import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormField, form } from '@angular/forms/signals';
import { forkJoin } from 'rxjs';
import { ScholarService } from '../../services/scholar.service';
import { AttendanceService } from '../../services/attendance.service';
import { SchoolService } from '../../services/school.service';
import { Scholar } from '../../interfaces/scholar';
import { ScholarAttendance } from '../../interfaces/scholar-attendance';
import { School } from '../../interfaces/school';
import {
  DEFAULT_MONTH,
  DEFAULT_YEAR,
  parseDateOnly,
  shiftMonth,
} from '../../utils/weekday-dates';
import { RonPipe } from '../../pipes/ron.pipe';
import { TimeSeriesChartComponent } from './time-series-chart/time-series-chart.component';
import { DonutChartComponent } from './donut-chart/donut-chart.component';
import { KpiTileComponent } from './kpi-tile/kpi-tile.component';
import { RankedBarChartComponent } from './ranked-bar-chart/ranked-bar-chart.component';
import { HeatmapComponent } from './heatmap/heatmap.component';
import { BarChartComponent } from './bar-chart/bar-chart.component';
import {
  attendanceCalendar,
  attendanceRate,
  averagePerDay,
  boysAndGirlsByClass,
  buildDailyPoints,
  busiestDay,
  busiestPickup,
  busiestPoint,
  busiestWeekday,
  chargesByScholar,
  countByGrade,
  elapsedWeekdays,
  genderSlices,
  monthlyAveragePerDay,
  monthlyRevenue,
  monthlySeries,
  monthsOfYear,
  percentChange,
  pickupHeatmap,
  revenueMix,
  revenueOf,
  schoolCount,
  serviceMix,
  shiftYear,
  topSchools,
  totalOf,
  totalsByMonth,
  trailingMonths,
  weekdayAverages,
  yearOverYear,
} from './charts-data';
import { extractErrorMessage } from '../../utils/extract-error-message';

const TREND_MONTHS = 12;

@Component({
  selector: 'app-charts',
  imports: [
    FormField,
    TimeSeriesChartComponent,
    DonutChartComponent,
    KpiTileComponent,
    RankedBarChartComponent,
    HeatmapComponent,
    BarChartComponent,
  ],
  providers: [RonPipe],
  templateUrl: './charts.component.html',
  styleUrl: './charts.component.css',
})
export class ChartsComponent {
  private readonly scholarService = inject(ScholarService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly schoolService = inject(SchoolService);
  private readonly ron = inject(RonPipe);
  private readonly today = new Date();

  private readonly data = rxResource({
    stream: () =>
      forkJoin({
        scholars: this.scholarService.getScholars(),
        allAttendance: this.attendanceService.getAllAttendance(),
        schools: this.schoolService.getSchools(),
      }),
  });
  private readonly scholars = computed<Scholar[]>(() =>
    this.data.hasValue() ? this.data.value().scholars : [],
  );
  private readonly allAttendance = computed<ScholarAttendance[]>(() =>
    this.data.hasValue() ? this.data.value().allAttendance : [],
  );
  private readonly schools = computed<School[]>(() =>
    this.data.hasValue() ? this.data.value().schools : [],
  );
  readonly loading = this.data.isLoading;
  readonly loadError = computed(() => {
    const error = this.data.error();
    return error
      ? extractErrorMessage(
          error as HttpErrorResponse,
          'Failed to load chart data',
        )
      : null;
  });

  private readonly byMonth = computed(() =>
    totalsByMonth(this.allAttendance()),
  );

  // ── The selected month ─────────────────────────────────────────────

  readonly monthForm = form(signal({ month: DEFAULT_MONTH }));
  readonly selectedMonth = computed(
    () => this.monthForm.month().value() || DEFAULT_MONTH,
  );
  readonly monthName = computed(() => this.monthLabel(this.selectedMonth()));
  private readonly previousMonth = computed(() =>
    shiftMonth(this.selectedMonth(), -1),
  );

  readonly dailyPoints = computed(() =>
    buildDailyPoints(this.allAttendance(), this.selectedMonth()),
  );
  readonly dailyPresent = computed(() =>
    this.dailyPoints().map((p) => ({
      key: p.key,
      label: p.label,
      value: p.present,
    })),
  );
  readonly busiestDayOfMonth = computed(() => {
    const busiest = busiestPoint(this.dailyPoints());
    return busiest
      ? { label: this.dayLabel(busiest.key), value: busiest.present }
      : null;
  });

  private rateFor(month: string): number | null {
    const points = buildDailyPoints(this.allAttendance(), month);
    return attendanceRate(
      totalOf(points, 'present'),
      this.scholars().length,
      elapsedWeekdays(month, this.today).length,
    );
  }

  readonly monthRate = computed(() => this.rateFor(this.selectedMonth()));
  readonly rateCaption = computed(() => {
    if (this.monthRate() === null) return 'month not started yet';
    const previous = this.rateFor(this.previousMonth());
    return previous === null
      ? 'of possible scholar-days'
      : `vs ${this.formatPercent(previous)} in ${this.monthLabel(this.previousMonth(), false)}`;
  });

  readonly monthAverage = computed(() => averagePerDay(this.dailyPoints()));
  readonly averageTrend = computed(() =>
    monthlySeries(
      this.byMonth(),
      trailingMonths(this.selectedMonth(), TREND_MONTHS),
      monthlyAveragePerDay,
    ).map((p) => p.value),
  );
  readonly averageCaption = computed(() => {
    const days = this.dailyPoints().filter((p) => p.present > 0).length;
    return `on ${days} school day${days === 1 ? '' : 's'}`;
  });

  readonly monthRevenue = computed(() => revenueOf(this.dailyPoints()));
  readonly revenueTrend = computed(() =>
    monthlySeries(
      this.byMonth(),
      trailingMonths(this.selectedMonth(), TREND_MONTHS),
      monthlyRevenue,
    ).map((p) => p.value),
  );
  readonly revenueCaption = computed(() => {
    const change = percentChange(
      this.monthRevenue(),
      monthlyRevenue(this.byMonth().get(this.previousMonth())),
    );
    return change === null
      ? 'lunch and transport'
      : `${this.formatChange(change)} vs ${this.monthLabel(this.previousMonth(), false)}`;
  });

  private readonly presentDays = computed(() =>
    totalOf(this.dailyPoints(), 'present'),
  );
  readonly lunchTakeUp = computed(() =>
    this.presentDays() > 0
      ? totalOf(this.dailyPoints(), 'lunchDays') / this.presentDays()
      : null,
  );
  readonly takeUpCaption = computed(() =>
    this.presentDays() > 0
      ? `transport on ${this.formatPercent(totalOf(this.dailyPoints(), 'transportDays') / this.presentDays())}`
      : 'of days attended',
  );

  readonly scholarCount = computed(() => this.scholars().length);
  readonly scholarsCaption = computed(() => {
    const count = schoolCount(this.scholars());
    return `from ${count} school${count === 1 ? '' : 's'}`;
  });

  readonly weekdays = computed(() => weekdayAverages(this.dailyPoints()));
  readonly busiestWeekday = computed(() => busiestWeekday(this.weekdays()));
  readonly services = computed(() =>
    serviceMix(this.allAttendance(), this.selectedMonth()),
  );
  readonly revenueSplit = computed(() => revenueMix(this.dailyPoints()));
  readonly charges = computed(() =>
    chargesByScholar(
      this.allAttendance(),
      this.scholars(),
      this.selectedMonth(),
      8,
    ),
  );

  // ── The selected year ──────────────────────────────────────────────

  readonly yearForm = form(signal({ year: DEFAULT_YEAR }));
  readonly selectedYear = computed(
    () => this.yearForm.year().value() || DEFAULT_YEAR,
  );
  private readonly yearMonths = computed(() =>
    monthsOfYear(this.selectedYear(), this.today),
  );
  readonly yearRevenue = computed(() =>
    monthlySeries(this.byMonth(), this.yearMonths(), monthlyRevenue),
  );
  readonly yearRevenueTotal = computed(() =>
    this.yearRevenue().reduce((sum, p) => sum + p.value, 0),
  );
  readonly yearComparison = computed(() => {
    const comparison = yearOverYear(
      this.byMonth(),
      this.selectedYear(),
      this.today,
    );
    const months = this.yearMonths();
    if (!comparison || months.length === 0) return null;
    return {
      change: this.formatChange(comparison.change),
      up: comparison.change >= 0,
      previousYear: comparison.previousYear,
      period:
        months.length === 12
          ? ''
          : ` over January–${this.monthLabel(months[months.length - 1], false)}`,
    };
  });
  readonly yearAverages = computed(() =>
    monthlySeries(this.byMonth(), this.yearMonths(), monthlyAveragePerDay),
  );
  readonly busiestMonthOfYear = computed(() =>
    this.yearAverages().reduce<{ label: string; value: number } | null>(
      (best, p) => (p.value > 0 && (!best || p.value > best.value) ? p : best),
      null,
    ),
  );
  readonly calendar = computed(() =>
    attendanceCalendar(this.allAttendance(), this.selectedYear()),
  );
  readonly busiestDayOfYear = computed(() =>
    busiestDay(this.allAttendance(), this.selectedYear()),
  );

  // ── Scholars ───────────────────────────────────────────────────────

  readonly classes = computed(() => countByGrade(this.scholars()));
  readonly genders = computed(() => genderSlices(this.scholars()));
  readonly boysAndGirls = computed(() => boysAndGirlsByClass(this.scholars()));
  readonly schoolRanking = computed(() =>
    topSchools(this.scholars(), this.schools(), 8),
  );
  readonly pickups = computed(() => pickupHeatmap(this.scholars()));
  readonly busiestPickupSlot = computed(() => busiestPickup(this.scholars()));

  previousMonthClicked(): void {
    this.monthForm.month().value.set(this.previousMonth());
  }

  nextMonthClicked(): void {
    this.monthForm.month().value.set(shiftMonth(this.selectedMonth(), 1));
  }

  previousYear(): void {
    this.yearForm.year().value.set(shiftYear(this.selectedYear(), -1));
  }

  nextYear(): void {
    this.yearForm.year().value.set(shiftYear(this.selectedYear(), 1));
  }

  private monthLabel(month: string, withYear = true): string {
    return parseDateOnly(`${month}-01`).toLocaleDateString('en-GB', {
      month: 'long',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  }

  private dayLabel(date: string): string {
    return parseDateOnly(date).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  readonly formatCount = (value: number): string => String(Math.round(value));
  readonly formatAverage = (value: number): string => value.toFixed(1);
  readonly formatPercent = (value: number): string =>
    `${Math.round(value * 100)}%`;
  readonly formatRon = (value: number): string =>
    this.ron.transform(value, '1.0-0');
  private formatChange(change: number): string {
    const percent = Math.round(change * 100);
    return `${percent > 0 ? '+' : ''}${percent}%`;
  }
}
