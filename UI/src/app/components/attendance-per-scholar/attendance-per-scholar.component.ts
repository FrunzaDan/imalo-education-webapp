import {
  Component,
  OnInit,
  OnDestroy,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';

import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { AttendanceService } from '../../services/attendance.service';
import { CsvExportService } from '../../services/csv-export.service';
import { NotificationService } from '../../services/notification.service';
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
  imports: [CurrencyPipe, DatePipe, FormField],
  templateUrl: './attendance-per-scholar.component.html',
  styleUrl: './attendance-per-scholar.component.css',
})
export class AttendancePerScholarComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly scholarsService = inject(ScholarsService);
  private readonly schoolsService = inject(SchoolsService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly csvExportService = inject(CsvExportService);
  private readonly notificationService = inject(NotificationService);

  private scholarSubscription: Subscription | undefined;
  private attendanceSubscription: Subscription | undefined;

  scholar = signal<Scholar | null>(null);
  scholarId: string = '';

  // Standard per-day prices for this scholar's school, applied when a day is
  // marked for the first time. 0 until the school has loaded (or if the
  // scholar has no school set). Not read directly by the template — only used
  // internally when seeding a newly-checked day's cost — so a plain field is
  // enough (same reasoning as ScholarTableComponent.scholars/schools).
  lunchPrice = 0;
  transportPrice = 0;

  // The full, unfiltered list for this scholar, as loaded from (and sent
  // back to) the API. Day rows for the selected month hold direct references
  // into this array once a day has been touched, so editing a row mutates
  // the record here too — Save just sends this array as-is. Not read
  // directly by the template either, so it stays a plain field too.
  allAttendanceRecords: AttendanceRecord[] = [];

  // 'YYYY-MM', the value format of <input type="month">. A one-field signal
  // form binds the picker; selectedMonth is its value.
  readonly monthForm = form(signal({ month: '' }));
  readonly selectedMonth = computed(() => this.monthForm.month().value());

  // Rebuilt from allAttendanceRecords whenever the selected month changes,
  // but still writable: the checkbox handlers re-set it after mutating a
  // row's record in place (see onLunchChange).
  readonly dayRows = linkedSignal<string, AttendanceDayRow[]>({
    source: this.selectedMonth,
    computation: (month) => this.buildDayRows(month),
  });

  // Derived from dayRows — a checkbox handler mutates a row's record in place
  // (so the checkbox stays bound to a stable object) and then re-sets dayRows
  // to a fresh array to both notify these and re-render.
  readonly totalSelectedLunchCost = computed(() =>
    this.dayRows().reduce(
      (sum, row) => sum + (row.record.lunchSelected ? row.record.lunchCost : 0),
      0,
    ),
  );
  readonly totalSelectedTransportCost = computed(() =>
    this.dayRows().reduce(
      (sum, row) => sum + (row.record.transportSelected ? row.record.transportCost : 0),
      0,
    ),
  );
  readonly grandTotal = computed(
    () => this.totalSelectedLunchCost() + this.totalSelectedTransportCost(),
  );

  isSaving = signal(false);
  hasUnsavedChanges = signal(false);

  ngOnInit(): void {
    const scholarId = this.route.snapshot.paramMap.get('id');
    if (!scholarId) {
      console.error('Scholar ID not found in route parameters.');
      return;
    }
    this.scholarId = scholarId;

    this.scholarSubscription = this.scholarsService.getScholars().subscribe({
      next: (scholars) => {
        const scholar = scholars.find((s) => s.id === scholarId) || null;
        this.scholar.set(scholar);

        if (!scholar) {
          console.warn(`Scholar with ID ${scholarId} not found.`);
          return;
        }

        if (scholar.schoolId != null) {
          this.schoolsService.getSchoolById(scholar.schoolId).subscribe({
            next: (school) => {
              this.lunchPrice = school?.lunchPrice ?? 0;
              this.transportPrice = school?.transportPrice ?? 0;
            },
          });
        }

        this.attendanceSubscription = this.attendanceService
          .getAttendanceByScholarId(scholarId)
          .subscribe({
            next: (attendanceData: AttendanceRecord[] | undefined) => {
              this.allAttendanceRecords = attendanceData ?? [];
              this.monthForm.month().value.set(this.pickDefaultMonth());
            },
            error: (err) => {
              console.error('Error fetching attendance data:', err);
              this.allAttendanceRecords = [];
              this.monthForm.month().value.set(this.pickDefaultMonth());
            },
          });
      },
      error: (err) => {
        console.error('Error fetching scholars:', err);
        this.scholar.set(null);
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

  private buildDayRows(selectedMonth: string): AttendanceDayRow[] {
    if (!selectedMonth) return [];

    const [year, month] = selectedMonth.split('-').map(Number);
    return getWeekdayDatesInMonth(year, month).map((date) => {
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
          present: false,
          lunchSelected: false,
          transportSelected: false,
        },
        isPersisted: false,
      };
    });
  }

  // Adds a day's record to the list that actually gets saved, the first time
  // it's touched. A no-op if it's already in there.
  private ensurePersisted(row: AttendanceDayRow): void {
    if (!row.isPersisted) {
      this.allAttendanceRecords.push(row.record);
      row.isPersisted = true;
    }
  }

  // Present gates Lunch/Transport: neither can be selected on a day the
  // scholar wasn't there. Unchecking Present clears both (rather than just
  // disabling their checkboxes going forward) so a day can never be saved
  // with Present false but Lunch/Transport true — the API rejects that
  // combination too (see [[api]]).
  onPresentChange(row: AttendanceDayRow, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    row.record.present = isChecked;

    if (!isChecked) {
      row.record.lunchSelected = false;
      row.record.transportSelected = false;
    } else {
      this.ensurePersisted(row);
    }

    this.hasUnsavedChanges.set(true);
    this.dayRows.update((rows) => [...rows]);
  }

  // Mutates row.record in place (so the checkbox's [checked] binding and any
  // other reference to this row stay pointed at the same object), then
  // re-sets dayRows to a new array so the totalSelected*/grandTotal computed
  // signals — and the template — pick the change up.
  //
  // Lunch and Transport are independent: toggling one never touches the
  // other. The "Both" checkbox (onBothChange) is the only thing that sets
  // both at once, and it's a plain reflection of "are both currently
  // checked", not a cascade rule — see its [checked] binding in the template.
  onLunchChange(row: AttendanceDayRow, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked && !row.record.present) return; // template also disables this checkbox

    row.record.lunchSelected = isChecked;

    if (isChecked) {
      if (row.record.lunchCost === 0) {
        row.record.lunchCost = this.lunchPrice;
      }
      this.ensurePersisted(row);
    }

    this.hasUnsavedChanges.set(true);
    this.dayRows.update((rows) => [...rows]);
  }

  onTransportChange(row: AttendanceDayRow, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked && !row.record.present) return; // template also disables this checkbox

    row.record.transportSelected = isChecked;

    if (isChecked) {
      if (row.record.transportCost === 0) {
        row.record.transportCost = this.transportPrice;
      }
      this.ensurePersisted(row);
    }

    this.hasUnsavedChanges.set(true);
    this.dayRows.update((rows) => [...rows]);
  }

  onBothChange(row: AttendanceDayRow, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked && !row.record.present) return; // template also disables this checkbox

    row.record.lunchSelected = isChecked;
    row.record.transportSelected = isChecked;
    if (isChecked) {
      if (row.record.lunchCost === 0) row.record.lunchCost = this.lunchPrice;
      if (row.record.transportCost === 0)
        row.record.transportCost = this.transportPrice;
      this.ensurePersisted(row);
    }
    this.hasUnsavedChanges.set(true);
    this.dayRows.update((rows) => [...rows]);
  }

  save(): void {
    if (!this.scholarId || this.isSaving()) return;

    this.isSaving.set(true);
    this.attendanceService
      .saveAttendance(this.scholarId, this.allAttendanceRecords)
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.hasUnsavedChanges.set(false);
          this.notificationService.show('Attendance saved successfully!');
        },
        error: (err) => {
          this.isSaving.set(false);
          console.error('Failed to save attendance:', err.message);
          this.notificationService.show(
            `Failed to save attendance. ${err.message}`,
            'error',
          );
        },
      });
  }

  trackByDayRow(index: number, row: AttendanceDayRow): string {
    return row.date;
  }

  exportCsv(): void {
    const scholar = this.scholar();
    const scholarName = scholar ? `${scholar.firstName}_${scholar.lastName}` : this.scholarId;

    this.csvExportService.export(
      `attendance_${scholarName}_${this.selectedMonth()}`,
      [
        { header: 'Date', value: (r: AttendanceDayRow) => r.date },
        {
          header: 'Present',
          value: (r: AttendanceDayRow) => (r.record.present ? 'Yes' : 'No'),
        },
        {
          header: 'Lunch Selected',
          value: (r: AttendanceDayRow) => (r.record.lunchSelected ? 'Yes' : 'No'),
        },
        {
          header: 'Transport Selected',
          value: (r: AttendanceDayRow) => (r.record.transportSelected ? 'Yes' : 'No'),
        },
        { header: 'Lunch Cost', value: (r: AttendanceDayRow) => r.record.lunchCost },
        { header: 'Transport Cost', value: (r: AttendanceDayRow) => r.record.transportCost },
      ],
      this.dayRows(),
    );
  }
}
