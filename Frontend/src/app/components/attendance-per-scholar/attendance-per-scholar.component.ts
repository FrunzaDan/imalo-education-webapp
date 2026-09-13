import {
  Component,
  OnInit,
  inject,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { AttendanceService } from '../../services/attendance.service';
import { Scholar } from '../../interfaces/scholar';
import { AttendanceRecord } from '../../interfaces/attendance-record';
import { getWeekdayDatesInMonth } from '../../utils/weekday-dates';

// One row per weekday of the selected month. `record` is always a real
// AttendanceRecord object so checkboxes can bind to it directly — for a day
// with no saved data yet it's a fresh, not-yet-persisted object that only
// gets added to allAttendanceRecords (and so included in the next Save) once
// the user actually checks a box for it.
interface AttendanceDayRow {
  date: string; // 'YYYY-MM-DD'
  record: AttendanceRecord;
  isPersisted: boolean;
}

@Component({
  selector: 'app-attendance-per-scholar',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './attendance-per-scholar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './attendance-per-scholar.component.css',
})
export class AttendancePerScholarComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly scholarsService = inject(ScholarsService);
  private readonly schoolsService = inject(SchoolsService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly cdr = inject(ChangeDetectorRef);

  private scholarSubscription: Subscription | undefined;
  private attendanceSubscription: Subscription | undefined;

  scholar: Scholar | null = null;
  scholarId: string = '';

  // Standard per-day prices for this scholar's school, applied when a day is
  // marked for the first time. 0 until the school has loaded (or if the
  // scholar has no school set).
  lunchPrice = 0;
  transportPrice = 0;

  // The full, unfiltered list for this scholar, as loaded from (and sent
  // back to) the API. Day rows for the selected month hold direct references
  // into this array once a day has been touched, so editing a row mutates
  // the record here too — Save just sends this array as-is.
  allAttendanceRecords: AttendanceRecord[] = [];

  selectedMonth: string = ''; // 'YYYY-MM', bound to <input type="month">
  dayRows: AttendanceDayRow[] = [];

  totalSelectedLunchCost: number = 0;
  totalSelectedTransportCost: number = 0;
  grandTotal: number = 0;

  isSaving: boolean = false;
  hasUnsavedChanges: boolean = false;

  ngOnInit(): void {
    const scholarId = this.route.snapshot.paramMap.get('id');
    if (!scholarId) {
      console.error('Scholar ID not found in route parameters.');
      return;
    }
    this.scholarId = scholarId;

    this.scholarSubscription = this.scholarsService.getScholars().subscribe({
      next: (scholars) => {
        this.scholar = scholars.find((s) => s.id === scholarId) || null;

        if (!this.scholar) {
          console.warn(`Scholar with ID ${scholarId} not found.`);
          this.cdr.markForCheck();
          return;
        }

        if (this.scholar.schoolId != null) {
          this.schoolsService.getSchoolById(this.scholar.schoolId).subscribe({
            next: (school) => {
              this.lunchPrice = school?.lunchPrice ?? 0;
              this.transportPrice = school?.transportPrice ?? 0;
              this.cdr.markForCheck();
            },
          });
        }

        this.attendanceSubscription = this.attendanceService
          .getAttendanceByScholarId(scholarId)
          .subscribe({
            next: (attendanceData: AttendanceRecord[] | undefined) => {
              this.allAttendanceRecords = attendanceData ?? [];
              this.selectedMonth = this.pickDefaultMonth();
              this.rebuildDayRows();
              this.cdr.markForCheck();
            },
            error: (err) => {
              console.error('Error fetching attendance data:', err);
              this.allAttendanceRecords = [];
              this.selectedMonth = this.pickDefaultMonth();
              this.rebuildDayRows();
              this.cdr.markForCheck();
            },
          });

        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching scholars:', err);
        this.scholar = null;
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    this.scholarSubscription?.unsubscribe();
    this.attendanceSubscription?.unsubscribe();
  }

  // Defaults to the most recent month that already has data, or the current
  // real-world month if this scholar has no attendance yet.
  private pickDefaultMonth(): string {
    if (this.allAttendanceRecords.length === 0) {
      return this.toMonthString(new Date());
    }
    const latest = this.allAttendanceRecords
      .map((r) => new Date(r.date))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return this.toMonthString(latest);
  }

  private toMonthString(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private toDateOnly(dateStr: string): string {
    return dateStr.substring(0, 10);
  }

  onMonthChange(): void {
    this.rebuildDayRows();
  }

  private rebuildDayRows(): void {
    if (!this.selectedMonth) {
      this.dayRows = [];
      this.updateTotals();
      return;
    }

    const [year, month] = this.selectedMonth.split('-').map(Number);
    this.dayRows = getWeekdayDatesInMonth(year, month).map(
      (date) => {
        const existing = this.allAttendanceRecords.find(
          (r) => this.toDateOnly(r.date) === date,
        );
        if (existing) {
          return { date, record: existing, isPersisted: true };
        }
        return {
          date,
          record: {
            date,
            lunchCost: 0,
            transportCost: 0,
            lunchSelected: false,
            transportSelected: false,
          },
          isPersisted: false,
        };
      },
    );

    this.updateTotals();
  }

  updateTotals(): void {
    this.totalSelectedLunchCost = this.dayRows.reduce(
      (sum, row) =>
        sum + (row.record.lunchSelected ? row.record.lunchCost : 0),
      0,
    );

    this.totalSelectedTransportCost = this.dayRows.reduce(
      (sum, row) =>
        sum + (row.record.transportSelected ? row.record.transportCost : 0),
      0,
    );

    this.grandTotal =
      this.totalSelectedLunchCost + this.totalSelectedTransportCost;
  }

  // Adds a day's record to the list that actually gets saved, the first time
  // it's touched. A no-op if it's already in there.
  private ensurePersisted(row: AttendanceDayRow): void {
    if (!row.isPersisted) {
      this.allAttendanceRecords.push(row.record);
      row.isPersisted = true;
    }
  }

  // Called after [(ngModel)] has already written the new checked state onto
  // the record — only cross-field cascade + first-time cost seeding happens
  // here, never a toggle of the field itself.
  onLunchChange(row: AttendanceDayRow): void {
    if (row.record.lunchSelected) {
      if (row.record.lunchCost === 0) {
        row.record.lunchCost = this.lunchPrice;
      }
      this.ensurePersisted(row);
    } else if (row.record.transportSelected) {
      // Transport implies lunch (e.g. school pickup includes the lunch
      // service) — turning lunch off turns transport off too.
      row.record.transportSelected = false;
    }
    this.hasUnsavedChanges = true;
    this.updateTotals();
  }

  onTransportChange(row: AttendanceDayRow): void {
    if (row.record.transportSelected) {
      if (row.record.transportCost === 0) {
        row.record.transportCost = this.transportPrice;
      }
      this.ensurePersisted(row);
    } else if (row.record.lunchSelected) {
      row.record.lunchSelected = false;
    }
    this.hasUnsavedChanges = true;
    this.updateTotals();
  }

  onBothChange(row: AttendanceDayRow, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    row.record.lunchSelected = isChecked;
    row.record.transportSelected = isChecked;
    if (isChecked) {
      if (row.record.lunchCost === 0) row.record.lunchCost = this.lunchPrice;
      if (row.record.transportCost === 0)
        row.record.transportCost = this.transportPrice;
      this.ensurePersisted(row);
    }
    this.hasUnsavedChanges = true;
    this.updateTotals();
  }

  save(): void {
    if (!this.scholarId || this.isSaving) return;

    this.isSaving = true;
    this.attendanceService
      .saveAttendance(this.scholarId, this.allAttendanceRecords)
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.hasUnsavedChanges = false;
          this.cdr.markForCheck();
          alert('Attendance saved successfully!');
        },
        error: (err) => {
          this.isSaving = false;
          this.cdr.markForCheck();
          console.error('Failed to save attendance:', err);
          alert('Failed to save attendance. Check console for details.');
        },
      });
  }

  trackByDayRow(index: number, row: AttendanceDayRow): string {
    return row.date;
  }
}
