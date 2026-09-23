import {
  Component,
  OnInit,
  OnDestroy,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { FieldTree, FormField, form } from '@angular/forms/signals';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';

import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { AttendanceService } from '../../services/attendance.service';
import { CsvExportService } from '../../services/csv-export.service';
import { NotificationService } from '../../services/notification.service';
import { Scholar } from '../../interfaces/scholar';
import { AttendanceRecord } from '../../interfaces/attendance-record';
import {
  AttendanceDay,
  attendanceFormSchema,
  toAttendanceDays,
  toAttendanceRecords,
  toDateOnly,
  toMonthString,
  weekdaysOfMonth,
  withWeekdayStubs,
} from './attendance-form';
import { DEFAULT_MONTH, shiftMonth } from '../../utils/weekday-dates';
import { RonPipe } from '../../pipes/ron.pipe';

@Component({
  selector: 'app-attendance-per-scholar',
  imports: [DatePipe, FormField, RonPipe],
  templateUrl: './attendance-per-scholar.component.html',
  styleUrl: './attendance-per-scholar.component.css',
})
export class AttendancePerScholarComponent implements OnInit, OnDestroy {
  private readonly scholarsService = inject(ScholarsService);
  private readonly schoolsService = inject(SchoolsService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly csvExportService = inject(CsvExportService);
  private readonly notificationService = inject(NotificationService);

  private scholarSubscription: Subscription | undefined;
  private attendanceSubscription: Subscription | undefined;

  // Bound from the `:id` route param by withComponentInputBinding() in app.config.ts.
  readonly id = input<string>();

  scholar = signal<Scholar | null>(null);
  scholarId: string = '';
  readonly today = new Date();

  // Standard per-day prices for this scholar's school, applied when a day is
  // marked for the first time. 0 until the school has loaded (or if the
  // scholar has no school set). Only read inside event handlers, never by the
  // template, so plain fields are enough.
  lunchPrice = 0;
  transportPrice = 0;

  // The school's name, for the printable invoice header. A signal (unlike
  // lunchPrice/transportPrice above) because the template reads it.
  schoolName = signal('');

  // 'YYYY-MM', the value format of <input type="month">. A one-field signal
  // form binds the picker; selectedMonth is its value.
  readonly monthForm = form(signal({ month: '' }));
  readonly selectedMonth = computed(() => this.monthForm.month().value());

  // What the API returned for this scholar, across all months.
  readonly loadedRecords = signal<AttendanceRecord[]>([]);

  // The form model: every loaded record plus a stub for each weekday of every
  // month looked at. A linkedSignal so that changing the month (or the load
  // landing) *adds* stubs to the previous value — unsaved edits to other months
  // survive a month switch — while still being writable for the form.
  readonly days = linkedSignal<
    { month: string; loaded: AttendanceRecord[] },
    AttendanceDay[]
  >({
    source: () => ({ month: this.selectedMonth(), loaded: this.loadedRecords() }),
    computation: ({ month, loaded }, previous) =>
      withWeekdayStubs(
        previous && previous.source.loaded === loaded
          ? previous.value
          : toAttendanceDays(loaded),
        month,
      ),
  });

  readonly attendanceForm = form(this.days, attendanceFormSchema);

  // Indexes into days() of the selected month's weekdays, in date order — the
  // template binds each row's checkboxes to attendanceForm[index].
  readonly visibleIndexes = computed(() => {
    const wanted = new Set(weekdaysOfMonth(this.selectedMonth()));
    return this.days()
      .map((day, index) => ({ date: toDateOnly(day.date), index }))
      .filter((entry) => wanted.has(entry.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => entry.index);
  });
  readonly dayRows = computed(() => this.visibleIndexes().map((i) => this.days()[i]));

  // The selected month as a Date (the 1st), so the invoice header can format
  // it with DatePipe instead of hand-building a "September 2026" string.
  // Falls back to today while the month form is still empty (before the
  // scholar/attendance load picks a default month) so DatePipe never sees
  // an invalid date.
  readonly monthLabel = computed(() => {
    const month = this.selectedMonth();
    if (!month) return this.today;
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber - 1, 1);
  });

  // What Save sends: loaded records plus every day the user has marked.
  readonly recordsToSave = computed(() => toAttendanceRecords(this.days()));

  readonly totalSelectedLunchCost = computed(() =>
    this.dayRows().reduce((sum, day) => sum + (day.lunchSelected ? day.lunchCost : 0), 0),
  );
  readonly totalSelectedTransportCost = computed(() =>
    this.dayRows().reduce(
      (sum, day) => sum + (day.transportSelected ? day.transportCost : 0),
      0,
    ),
  );
  readonly grandTotal = computed(
    () => this.totalSelectedLunchCost() + this.totalSelectedTransportCost(),
  );

  isSaving = signal(false);
  hasUnsavedChanges = signal(false);

  protected readonly toDateOnly = toDateOnly;

  ngOnInit(): void {
    const scholarId = this.id();
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
              this.schoolName.set(school?.name ?? '');
            },
          });
        }

        this.attendanceSubscription = this.attendanceService
          .getAttendanceByScholarId(scholarId)
          .subscribe({
            next: (attendanceData: AttendanceRecord[] | undefined) => {
              this.showRecords(attendanceData ?? []);
            },
            error: (err) => {
              console.error('Error fetching attendance data:', err);
              this.showRecords([]);
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

  previousMonth(): void {
    this.monthForm.month().value.set(shiftMonth(this.selectedMonth(), -1));
  }

  nextMonth(): void {
    this.monthForm.month().value.set(shiftMonth(this.selectedMonth(), 1));
  }

  private showRecords(records: AttendanceRecord[]): void {
    this.loadedRecords.set(records);
    this.monthForm.month().value.set(this.pickDefaultMonth(records));
  }

  // Defaults to the most recent month that already has data, or
  // DEFAULT_MONTH if this scholar has no attendance yet.
  private pickDefaultMonth(records: AttendanceRecord[]): string {
    if (records.length === 0) {
      return DEFAULT_MONTH;
    }
    const latest = records
      .map((r) => new Date(r.date))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return toMonthString(latest);
  }

  // Adds a day to what Save sends, the first time it's marked. Once persisted
  // it stays persisted (even if later unchecked) — same as before.
  private markPersisted(day: FieldTree<AttendanceDay>): void {
    day.persisted().value.set(true);
  }

  // The three handlers below run on `change`, which the browser fires *after*
  // `input` — the event [formField] listens to — so by the time they run the
  // checkbox's own field already holds its new value. They apply the rules that
  // are reactions to a change (the gating itself is the schema's `disabled()`).

  // Unchecking Present clears Lunch/Transport (rather than just disabling their
  // checkboxes going forward) so a day can never be saved with Present false
  // but Lunch/Transport true — the API rejects that combination too (see [[api]]).
  onPresentChange(index: number): void {
    const day = this.attendanceForm[index];

    if (day.present().value()) {
      this.markPersisted(day);
    } else {
      day.lunchSelected().value.set(false);
      day.transportSelected().value.set(false);
    }

    this.hasUnsavedChanges.set(true);
  }

  // Lunch and Transport are independent: toggling one never touches the
  // other. The "Both" checkbox (onBothChange) is the only thing that sets
  // both at once, and it's a plain reflection of "are both currently
  // checked", not a cascade rule — see its [checked] binding in the template.
  onLunchChange(index: number): void {
    const day = this.attendanceForm[index];

    if (day.lunchSelected().value()) {
      if (!day.present().value()) {
        day.lunchSelected().value.set(false); // the field is disabled too; belt and braces
        return;
      }
      if (day.lunchCost().value() === 0) day.lunchCost().value.set(this.lunchPrice);
      this.markPersisted(day);
    }

    this.hasUnsavedChanges.set(true);
  }

  onTransportChange(index: number): void {
    const day = this.attendanceForm[index];

    if (day.transportSelected().value()) {
      if (!day.present().value()) {
        day.transportSelected().value.set(false);
        return;
      }
      if (day.transportCost().value() === 0) {
        day.transportCost().value.set(this.transportPrice);
      }
      this.markPersisted(day);
    }

    this.hasUnsavedChanges.set(true);
  }

  // "Both" isn't a field of the model — it's a shortcut that sets two fields,
  // so it stays a plain [checked] + (change) control.
  onBothChange(index: number, event: Event): void {
    const day = this.attendanceForm[index];
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked && !day.present().value()) return; // template also disables this checkbox

    day.lunchSelected().value.set(isChecked);
    day.transportSelected().value.set(isChecked);
    if (isChecked) {
      if (day.lunchCost().value() === 0) day.lunchCost().value.set(this.lunchPrice);
      if (day.transportCost().value() === 0) {
        day.transportCost().value.set(this.transportPrice);
      }
      this.markPersisted(day);
    }

    this.hasUnsavedChanges.set(true);
  }

  save(): void {
    if (!this.scholarId || this.isSaving()) return;

    this.isSaving.set(true);
    this.attendanceService
      .saveAttendance(this.scholarId, this.recordsToSave())
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

  exportCsv(): void {
    const scholar = this.scholar();
    const scholarName = scholar ? `${scholar.firstName}_${scholar.lastName}` : this.scholarId;

    this.csvExportService.export(
      `attendance_${scholarName}_${this.selectedMonth()}`,
      [
        { header: 'Date', value: (r: AttendanceDay) => toDateOnly(r.date) },
        {
          header: 'Present',
          value: (r: AttendanceDay) => (r.present ? 'Yes' : 'No'),
        },
        {
          header: 'Lunch Selected',
          value: (r: AttendanceDay) => (r.lunchSelected ? 'Yes' : 'No'),
        },
        {
          header: 'Transport Selected',
          value: (r: AttendanceDay) => (r.transportSelected ? 'Yes' : 'No'),
        },
        { header: 'Lunch Cost', value: (r: AttendanceDay) => r.lunchCost },
        { header: 'Transport Cost', value: (r: AttendanceDay) => r.transportCost },
      ],
      this.dayRows(),
    );
  }

  // Opens the browser's print dialog over the invoice-only view (see the
  // .no-print/.print-only classes in the template and global styles.css).
  // Saving as PDF from there avoids pulling in a PDF-generation dependency
  // for what the browser already does natively.
  printInvoice(): void {
    window.print();
  }
}
