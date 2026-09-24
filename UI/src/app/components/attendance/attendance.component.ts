import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormField, form } from '@angular/forms/signals';
import { forkJoin } from 'rxjs';
import { ScholarService } from '../../services/scholar.service';
import { AttendanceService } from '../../services/attendance.service';
import { CsvExportService } from '../../services/csv-export.service';
import { Scholar } from '../../interfaces/scholar';
import { ScholarAttendance } from '../../interfaces/scholar-attendance';
import {
  DEFAULT_MONTH,
  shiftMonth,
  weekdaysOfMonth,
} from '../../utils/weekday-dates';
import {
  buildScholarRows,
  cellLabel,
  countsByDay,
  ScholarAttendanceRow,
  sum,
} from './attendance-grid';
import { extractErrorMessage } from '../../utils/extract-error-message';

@Component({
  selector: 'app-attendance',
  imports: [DatePipe, RouterModule, FormField],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.css',
})
export class AttendanceComponent {
  private readonly scholarService = inject(ScholarService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly csvExportService = inject(CsvExportService);

  // Everything the page needs, fetched in parallel once per visit. hasValue()
  // guards the reads: value() throws while the resource is in error.
  private readonly data = rxResource({
    stream: () =>
      forkJoin({
        scholars: this.scholarService.getScholars(),
        allAttendance: this.attendanceService.getAllScholarAttendance(),
      }),
  });
  private readonly scholars = computed<Scholar[]>(() =>
    this.data.hasValue() ? this.data.value().scholars : [],
  );
  private readonly allAttendance = computed<ScholarAttendance[]>(() =>
    this.data.hasValue() ? this.data.value().allAttendance : [],
  );
  readonly loading = this.data.isLoading;
  readonly loadError = computed(() => {
    const error = this.data.error();
    return error
      ? extractErrorMessage(
          error as HttpErrorResponse,
          'Failed to load attendance',
        )
      : null;
  });

  // 'YYYY-MM', the value format of <input type="month">, defaulting to
  // DEFAULT_MONTH. The prev/next arrows write straight into it.
  readonly monthForm = form(signal({ month: DEFAULT_MONTH }));
  readonly selectedMonth = computed(() => this.monthForm.month().value());

  readonly weekdayDates = computed(() => weekdaysOfMonth(this.selectedMonth()));
  readonly rows = computed(() =>
    buildScholarRows(
      this.scholars(),
      this.allAttendance(),
      this.selectedMonth(),
    ),
  );

  // Footer summary: one Present/Lunch/Transport count per day, plus the
  // month's totals below that.
  readonly dailyCounts = computed(() =>
    countsByDay(this.rows(), this.weekdayDates().length),
  );
  readonly totalPresent = computed(() => sum(this.dailyCounts().present));
  readonly totalLunch = computed(() => sum(this.dailyCounts().lunchSelected));
  readonly totalTransport = computed(() =>
    sum(this.dailyCounts().transportSelected),
  );

  previousMonth(): void {
    this.monthForm.month().value.set(shiftMonth(this.selectedMonth(), -1));
  }

  nextMonth(): void {
    this.monthForm.month().value.set(shiftMonth(this.selectedMonth(), 1));
  }

  exportCsv(): void {
    const dates = this.weekdayDates();

    this.csvExportService.export(
      `attendance_${this.selectedMonth()}`,
      [
        {
          header: 'Scholar',
          value: (r: ScholarAttendanceRow) => r.scholarName,
        },
        ...dates.map((date, index) => ({
          header: date,
          value: (r: ScholarAttendanceRow) => cellLabel(r.cells[index]),
        })),
      ],
      this.rows(),
    );
  }
}
