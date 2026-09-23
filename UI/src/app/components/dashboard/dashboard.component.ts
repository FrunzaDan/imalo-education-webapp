import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { RouterModule } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ScholarService } from '../../services/scholar.service';
import { SchoolService } from '../../services/school.service';
import { AttendanceService } from '../../services/attendance.service';
import { GlobalAuditLogService } from '../../services/global-audit-log.service';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { ScholarAttendance } from '../../interfaces/scholar-attendance';
import { GlobalAuditLogEntry } from '../../interfaces/global-audit-log-entry';
import { toMonthString, weekdaysOfMonth } from '../../utils/weekday-dates';
import { RonPipe } from '../../pipes/ron.pipe';
import { buildDailyPoints, totalOf } from '../charts/charts-data';
import {
  todaysPickups as computeTodaysPickups,
  todayWeekdayKey,
  upcomingBirthdays as computeUpcomingBirthdays,
} from './dashboard-data';
import { extractErrorMessage } from '../../utils/extract-error-message';

@Component({
  selector: 'app-dashboard',
  imports: [RouterModule, DatePipe, RonPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly scholarService = inject(ScholarService);
  private readonly schoolService = inject(SchoolService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly globalAuditLogService = inject(GlobalAuditLogService);

  private readonly scholars = signal<Scholar[]>([]);
  private readonly schools = signal<School[]>([]);
  private readonly allAttendance = signal<ScholarAttendance[]>([]);
  loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly recentActivity = this.globalAuditLogService.entries;

  readonly today = new Date();
  private readonly currentMonth = toMonthString(this.today);

  readonly totalScholars = computed(() => this.scholars().length);
  readonly totalSchools = computed(() => this.schools().length);

  private readonly monthDailyPoints = computed(() =>
    buildDailyPoints(this.allAttendance(), this.currentMonth),
  );
  private readonly monthWeekdays = computed(() =>
    weekdaysOfMonth(this.currentMonth),
  );
  readonly monthRevenue = computed(
    () =>
      totalOf(this.monthDailyPoints(), 'lunchRevenue') +
      totalOf(this.monthDailyPoints(), 'transportRevenue'),
  );
  readonly monthAttendanceRate = computed(() => {
    const capacity = this.scholars().length * this.monthWeekdays().length;
    const present = totalOf(this.monthDailyPoints(), 'present');
    return capacity > 0 ? Math.round((present / capacity) * 100) : 0;
  });

  readonly isWeekend = computed(() => todayWeekdayKey(this.today) === null);
  readonly todaysPickups = computed(() =>
    computeTodaysPickups(this.scholars(), this.schools(), this.today),
  );
  readonly upcomingBirthdays = computed(() =>
    computeUpcomingBirthdays(this.scholars(), this.today, 30),
  );

  ngOnInit(): void {
    forkJoin({
      scholars: this.scholarService.getScholars(),
      schools: this.schoolService.getSchools(),
      allAttendance: this.attendanceService.getAllScholarAttendance(),
    }).subscribe({
      next: ({ scholars, schools, allAttendance }) => {
        this.scholars.set(scholars);
        this.schools.set(schools);
        this.allAttendance.set(allAttendance);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loadError.set(
          extractErrorMessage(error, 'Failed to load the dashboard'),
        );
        this.loading.set(false);
      },
    });

    this.globalAuditLogService.loadAllAuditLog({ pageNumber: 1, pageSize: 5 });
  }

  // A deleted scholar has no name to link to — see GlobalAuditLogEntry.
  scholarLabel(entry: GlobalAuditLogEntry): string {
    if (!entry.scholarFirstName && !entry.scholarLastName) {
      return `(deleted scholar ${entry.scholarId})`;
    }
    return `${entry.scholarFirstName ?? ''} ${entry.scholarLastName ?? ''}`.trim();
  }

  hasScholarLink(entry: GlobalAuditLogEntry): boolean {
    return !!(entry.scholarFirstName || entry.scholarLastName);
  }
}
