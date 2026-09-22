import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormField, form } from '@angular/forms/signals';
import { forkJoin } from 'rxjs';
import { ScholarsService } from '../../services/scholars.service';
import { AttendanceService } from '../../services/attendance.service';
import { CsvExportService } from '../../services/csv-export.service';
import { Scholar } from '../../interfaces/scholar';
import { ScholarAttendance } from '../../interfaces/scholar-attendance';
import { shiftMonth, toMonthString, weekdaysOfMonth } from '../../utils/weekday-dates';
import { buildScholarRows, cellLabel, ScholarAttendanceRow } from './attendance-grid';

@Component({
  selector: 'app-attendance',
  imports: [DatePipe, RouterModule, FormField],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.css',
})
export class AttendanceComponent implements OnInit {
  private readonly scholarsService = inject(ScholarsService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly csvExportService = inject(CsvExportService);

  private readonly scholars = signal<Scholar[]>([]);
  private readonly allAttendance = signal<ScholarAttendance[]>([]);
  loading = signal(true);

  // 'YYYY-MM', the value format of <input type="month">, defaulting to the
  // current real-world month. The prev/next arrows write straight into it.
  readonly monthForm = form(signal({ month: toMonthString(new Date()) }));
  readonly selectedMonth = computed(() => this.monthForm.month().value());

  readonly weekdayDates = computed(() => weekdaysOfMonth(this.selectedMonth()));
  readonly rows = computed(() =>
    buildScholarRows(this.scholars(), this.allAttendance(), this.selectedMonth()),
  );

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    forkJoin({
      scholars: this.scholarsService.getScholars(),
      allAttendance: this.attendanceService.getAllScholarAttendance(),
    }).subscribe({
      next: ({ scholars, allAttendance }) => {
        this.scholars.set(scholars);
        this.allAttendance.set(allAttendance);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load attendance overview:', err);
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

  exportCsv(): void {
    const dates = this.weekdayDates();

    this.csvExportService.export(
      `attendance_${this.selectedMonth()}`,
      [
        { header: 'Scholar', value: (r: ScholarAttendanceRow) => r.scholarName },
        ...dates.map((date, index) => ({
          header: date,
          value: (r: ScholarAttendanceRow) => cellLabel(r.cells[index]),
        })),
      ],
      this.rows(),
    );
  }
}
