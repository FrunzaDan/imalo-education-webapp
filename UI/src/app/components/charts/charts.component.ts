import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
  shiftMonth,
  weekdaysOfMonth,
} from '../../utils/weekday-dates';
import { RonPipe } from '../../pipes/ron.pipe';
import {
  BarChartComponent,
  BarChartPoint,
} from './bar-chart/bar-chart.component';
import {
  buildDailyPoints,
  buildMonthlyPoints,
  busiestPoint,
  countByGrade,
  countBySchool,
  shiftYear,
  topCategory,
  totalOf,
} from './charts-data';
import { extractErrorMessage } from '../../utils/extract-error-message';

@Component({
  selector: 'app-charts',
  imports: [FormField, BarChartComponent, RonPipe],
  templateUrl: './charts.component.html',
  styleUrl: './charts.component.css',
})
export class ChartsComponent implements OnInit {
  private readonly scholarService = inject(ScholarService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly schoolService = inject(SchoolService);

  private readonly scholars = signal<Scholar[]>([]);
  private readonly allAttendance = signal<ScholarAttendance[]>([]);
  private readonly schools = signal<School[]>([]);
  loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly classCounts = computed(() => countByGrade(this.scholars()));
  readonly schoolCounts = computed(() =>
    countBySchool(this.scholars(), this.schools()),
  );
  readonly topClass = computed(() => topCategory(this.classCounts()));
  readonly topSchool = computed(() => topCategory(this.schoolCounts()));

  readonly monthForm = form(signal({ month: DEFAULT_MONTH }));
  readonly selectedMonth = computed(() => this.monthForm.month().value());
  private readonly weekdaysInMonth = computed(() =>
    weekdaysOfMonth(this.selectedMonth()),
  );

  readonly yearForm = form(signal({ year: DEFAULT_YEAR }));
  readonly selectedYear = computed(
    () => this.yearForm.year().value() || DEFAULT_YEAR,
  );

  readonly dailyPoints = computed(() =>
    buildDailyPoints(this.allAttendance(), this.selectedMonth()),
  );
  readonly monthlyPoints = computed(() =>
    buildMonthlyPoints(this.allAttendance(), this.selectedYear()),
  );

  readonly dailyPresentBars = computed<BarChartPoint[]>(() =>
    this.dailyPoints().map((p) => ({
      key: p.key,
      label: p.label,
      value: p.present,
    })),
  );
  readonly dailyRevenueBars = computed<BarChartPoint[]>(() =>
    this.dailyPoints().map((p) => ({
      key: p.key,
      label: p.label,
      value: p.transportRevenue,
      value2: p.lunchRevenue,
    })),
  );
  readonly monthlyPresentBars = computed<BarChartPoint[]>(() =>
    this.monthlyPoints().map((p) => ({
      key: p.key,
      label: p.label,
      value: p.present,
    })),
  );
  readonly monthlyRevenueBars = computed<BarChartPoint[]>(() =>
    this.monthlyPoints().map((p) => ({
      key: p.key,
      label: p.label,
      value: p.transportRevenue,
      value2: p.lunchRevenue,
    })),
  );

  readonly monthTotalPresent = computed(() =>
    totalOf(this.dailyPoints(), 'present'),
  );
  readonly monthTotalLunch = computed(() =>
    totalOf(this.dailyPoints(), 'lunchRevenue'),
  );
  readonly monthTotalTransport = computed(() =>
    totalOf(this.dailyPoints(), 'transportRevenue'),
  );
  readonly monthTotalRevenue = computed(
    () => this.monthTotalLunch() + this.monthTotalTransport(),
  );
  readonly monthAttendanceRate = computed(() => {
    const capacity = this.scholars().length * this.weekdaysInMonth().length;
    return capacity > 0
      ? Math.round((this.monthTotalPresent() / capacity) * 100)
      : 0;
  });

  readonly yearTotalPresent = computed(() =>
    totalOf(this.monthlyPoints(), 'present'),
  );
  readonly yearTotalLunch = computed(() =>
    totalOf(this.monthlyPoints(), 'lunchRevenue'),
  );
  readonly yearTotalTransport = computed(() =>
    totalOf(this.monthlyPoints(), 'transportRevenue'),
  );
  readonly yearTotalRevenue = computed(
    () => this.yearTotalLunch() + this.yearTotalTransport(),
  );
  readonly busiestMonth = computed(() => busiestPoint(this.monthlyPoints()));
  readonly yearAvgMonthlyRevenue = computed(() => {
    const activeMonths = this.monthlyPoints().filter(
      (p) => p.present > 0,
    ).length;
    return activeMonths > 0 ? this.yearTotalRevenue() / activeMonths : 0;
  });

  ngOnInit(): void {
    forkJoin({
      scholars: this.scholarService.getScholars(),
      allAttendance: this.attendanceService.getAllScholarAttendance(),
      schools: this.schoolService.getSchools(),
    }).subscribe({
      next: ({ scholars, allAttendance, schools }) => {
        this.scholars.set(scholars);
        this.allAttendance.set(allAttendance);
        this.schools.set(schools);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loadError.set(
          extractErrorMessage(error, 'Failed to load chart data'),
        );
        this.loading.set(false);
      },
    });
  }

  previousMonth(): void {
    this.monthForm.month().value.set(shiftMonth(this.selectedMonth(), -1));
  }

  nextMonth(): void {
    this.monthForm.month().value.set(shiftMonth(this.selectedMonth(), 1));
  }

  previousYear(): void {
    this.yearForm.year().value.set(shiftYear(this.selectedYear(), -1));
  }

  nextYear(): void {
    this.yearForm.year().value.set(shiftYear(this.selectedYear(), 1));
  }

  formatCount = (value: number): string => String(value);
  formatRon = (value: number): string => `${value.toFixed(0)} RON`;
}
