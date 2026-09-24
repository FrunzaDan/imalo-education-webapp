import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { FieldTree, FormField, form } from '@angular/forms/signals';
import { DatePipe } from '@angular/common';
import { map, switchMap } from 'rxjs';

import { ScholarService } from '../../services/scholar.service';
import { SchoolService } from '../../services/school.service';
import { AttendanceService } from '../../services/attendance.service';
import { CsvExportService } from '../../services/csv-export.service';
import { Scholar } from '../../interfaces/scholar';
import { AttendanceRecord } from '../../interfaces/attendance-record';
import {
  AttendanceDay,
  attendanceFormSchema,
  toAttendanceDays,
  toAttendanceRecords,
  weekdaysOfMonth,
  withWeekdayStubs,
} from './attendance-form';
import { DEFAULT_MONTH, shiftMonth } from '../../utils/weekday-dates';
import { RonPipe } from '../../pipes/ron.pipe';
import { extractErrorMessage } from '../../utils/extract-error-message';
import { HasUnsavedChanges } from '../../services/unsaved-changes.guard';

@Component({
  selector: 'app-attendance-per-scholar',
  imports: [DatePipe, FormField, RonPipe],
  templateUrl: './attendance-per-scholar.component.html',
  styleUrl: './attendance-per-scholar.component.css',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class AttendancePerScholarComponent implements HasUnsavedChanges {
  private readonly scholarService = inject(ScholarService);
  private readonly schoolService = inject(SchoolService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly csvExportService = inject(CsvExportService);

  readonly scholarId = input<string>();

  private readonly data = rxResource({
    params: () => this.scholarId(),
    stream: ({ params: scholarId }) =>
      this.scholarService
        .getScholar(scholarId)
        .pipe(
          switchMap((scholar) =>
            this.attendanceService
              .getAttendance(scholarId)
              .pipe(map((records) => ({ scholar, records }))),
          ),
        ),
  });
  readonly scholar = computed<Scholar | null>(() =>
    this.data.hasValue() ? this.data.value().scholar : null,
  );
  readonly loadError = computed(() => {
    const error = this.data.error();
    return error
      ? extractErrorMessage(
          error as HttpErrorResponse,
          'Failed to load attendance',
        )
      : null;
  });
  readonly today = new Date();

  readonly loadedRecords = computed<AttendanceRecord[]>(() =>
    this.data.hasValue() ? this.data.value().records : [],
  );

  private readonly schoolResource = rxResource({
    params: () => this.scholar()?.schoolId ?? undefined,
    stream: ({ params: schoolId }) => this.schoolService.getSchool(schoolId),
  });
  private readonly school = computed(() =>
    this.schoolResource.hasValue() ? this.schoolResource.value() : null,
  );

  private readonly lunchPrice = computed(() => this.school()?.lunchPrice ?? 0);
  private readonly transportPrice = computed(
    () => this.school()?.transportPrice ?? 0,
  );

  readonly schoolName = computed(() => this.school()?.name ?? '');

  readonly monthForm = form(
    linkedSignal(() => ({
      month: this.data.hasValue()
        ? pickDefaultMonth(this.data.value().records)
        : '',
    })),
  );
  readonly selectedMonth = computed(() => this.monthForm.month().value());

  readonly days = linkedSignal<
    { month: string; loaded: AttendanceRecord[] },
    AttendanceDay[]
  >({
    source: () => ({
      month: this.selectedMonth(),
      loaded: this.loadedRecords(),
    }),
    computation: ({ month, loaded }, previous) =>
      withWeekdayStubs(
        previous && previous.source.loaded === loaded
          ? previous.value
          : toAttendanceDays(loaded),
        month,
      ),
  });

  readonly attendanceForm = form(this.days, attendanceFormSchema);

  readonly visibleIndexes = computed(() => {
    const wanted = new Set(weekdaysOfMonth(this.selectedMonth()));
    return this.days()
      .map((day, index) => ({ date: day.date, index }))
      .filter((entry) => wanted.has(entry.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => entry.index);
  });
  readonly dayRows = computed(() =>
    this.visibleIndexes().map((i) => this.days()[i]),
  );

  readonly monthLabel = computed(() => {
    const month = this.selectedMonth();
    if (!month) return this.today;
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber - 1, 1);
  });

  readonly recordsToSave = computed(() => toAttendanceRecords(this.days()));

  readonly totalSelectedLunchCost = computed(() =>
    this.dayRows().reduce(
      (sum, day) => sum + (day.lunchSelected ? day.lunchCost : 0),
      0,
    ),
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
  readonly saveError = signal<string | null>(null);
  readonly hasUnsavedChanges = signal(false);

  previousMonth(): void {
    this.monthForm.month().value.set(shiftMonth(this.selectedMonth(), -1));
  }

  nextMonth(): void {
    this.monthForm.month().value.set(shiftMonth(this.selectedMonth(), 1));
  }

  private markPersisted(day: FieldTree<AttendanceDay>): void {
    day.persisted().value.set(true);
  }

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

  onLunchChange(index: number): void {
    const day = this.attendanceForm[index];

    if (day.lunchSelected().value()) {
      if (!day.present().value()) {
        day.lunchSelected().value.set(false);
        return;
      }
      if (day.lunchCost().value() === 0)
        day.lunchCost().value.set(this.lunchPrice());
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
        day.transportCost().value.set(this.transportPrice());
      }
      this.markPersisted(day);
    }

    this.hasUnsavedChanges.set(true);
  }

  onBothChange(index: number, event: Event): void {
    const day = this.attendanceForm[index];
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked && !day.present().value()) return;

    day.lunchSelected().value.set(isChecked);
    day.transportSelected().value.set(isChecked);
    if (isChecked) {
      if (day.lunchCost().value() === 0)
        day.lunchCost().value.set(this.lunchPrice());
      if (day.transportCost().value() === 0) {
        day.transportCost().value.set(this.transportPrice());
      }
      this.markPersisted(day);
    }

    this.hasUnsavedChanges.set(true);
  }

  save(): void {
    const scholarId = this.scholarId();
    if (!scholarId || this.isSaving()) return;

    this.isSaving.set(true);
    this.saveError.set(null);
    this.attendanceService
      .saveAttendance(scholarId, this.recordsToSave())
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.hasUnsavedChanges.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.isSaving.set(false);
          this.saveError.set(
            extractErrorMessage(error, 'Failed to save attendance'),
          );
        },
      });
  }

  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  exportCsv(): void {
    const scholar = this.scholar();
    const scholarName = scholar
      ? `${scholar.firstName}_${scholar.lastName}`
      : this.scholarId();

    this.csvExportService.export(
      `attendance_${scholarName}_${this.selectedMonth()}`,
      [
        { header: 'Date', value: (r: AttendanceDay) => r.date },
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
        {
          header: 'Transport Cost',
          value: (r: AttendanceDay) => r.transportCost,
        },
      ],
      this.dayRows(),
    );
  }

  printInvoice(): void {
    window.print();
  }
}

function pickDefaultMonth(records: AttendanceRecord[]): string {
  if (records.length === 0) {
    return DEFAULT_MONTH;
  }
  const latest = records
    .map((r) => r.date)
    .sort()
    .at(-1)!;
  return latest.substring(0, 7);
}
