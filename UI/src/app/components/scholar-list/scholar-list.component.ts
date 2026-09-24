import {
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormField, form } from '@angular/forms/signals';
import { ScholarService } from '../../services/scholar.service';
import { SchoolService } from '../../services/school.service';
import { SortingService } from '../../services/sorting.service';
import { CsvExportService } from '../../services/csv-export.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { NgStyle } from '@angular/common';
import { forkJoin, from, of } from 'rxjs';
import { catchError, concatMap, map, toArray } from 'rxjs/operators';
import { RouterModule } from '@angular/router';
import { contrastTextColor } from '../../utils/contrast-color';
import { parseDateOnly } from '../../utils/weekday-dates';
import { extractErrorMessage } from '../../utils/extract-error-message';

interface TransformedScholarData {
  scholarId: string;
  name: string;
  schoolName: string;
  grade: number | null;
  schoolColor: string;
  birthDate: string;
  textColor: string;
}

@Component({
  imports: [FormField, NgStyle, RouterModule],
  selector: 'app-scholar-list',
  templateUrl: './scholar-list.component.html',
  styleUrl: './scholar-list.component.css',
})
export class ScholarListComponent {
  private readonly scholarService = inject(ScholarService);
  private readonly schoolService = inject(SchoolService);
  private readonly sortingService = inject(SortingService);
  private readonly csvExportService = inject(CsvExportService);
  private readonly notificationService = inject(NotificationService);
  private readonly confirmDialogService = inject(ConfirmDialogService);

  // Scholars and schools, fetched in parallel; reload() after a bulk delete.
  // hasValue() guards the read: value() throws while the resource is in error.
  private readonly data = rxResource({
    stream: () =>
      forkJoin({
        scholars: this.scholarService.getScholars(),
        schools: this.schoolService.getSchools(),
      }),
  });
  // The first load only: a reload (after a bulk delete) keeps the table on
  // screen with the previous rows until the fresh ones arrive.
  readonly loading = computed(() => this.data.status() === 'loading');
  readonly loadError = computed(() => {
    const error = this.data.error();
    return error
      ? extractErrorMessage(
          error as HttpErrorResponse,
          'Failed to load scholars',
        )
      : null;
  });

  private readonly rows = computed(() =>
    this.data.hasValue()
      ? toRows(this.data.value().scholars, this.data.value().schools)
      : [],
  );

  readonly currentSortColumn = signal<keyof TransformedScholarData | ''>('');
  private readonly currentSortType = signal<'string' | 'number' | 'date'>(
    'string',
  );
  readonly isAscending = signal(true);

  readonly scholarData = computed(() => {
    const column = this.currentSortColumn();
    return column
      ? this.sortingService.sort(
          this.rows(),
          column,
          this.currentSortType(),
          this.isAscending(),
        )
      : this.rows();
  });

  // A one-field signal form for the search box; searchTerm is its value.
  readonly searchForm = form(signal({ term: '' }));
  readonly searchTerm = computed(() => this.searchForm.term().value());

  // Emptied whenever the rows reload: stale selections would otherwise
  // reference rows that may no longer exist.
  readonly selectedScholarIds = linkedSignal<
    TransformedScholarData[],
    Set<string>
  >({
    source: this.rows,
    computation: () => new Set(),
  });
  bulkDeleteInProgress = signal(false);

  sortData(
    column: keyof TransformedScholarData,
    type: 'string' | 'number' | 'date',
  ): void {
    if (this.currentSortColumn() === column) {
      this.isAscending.update((ascending) => !ascending);
    } else {
      this.currentSortColumn.set(column);
      this.currentSortType.set(type);
      this.isAscending.set(true);
    }
  }

  // The full loaded/sorted list is client-side filtered by name for display —
  // this dataset is small enough that a server round-trip per keystroke (the
  // pattern Customer_Management_System uses, justified there by server-side
  // pagination) would just be unnecessary latency here.
  readonly displayedScholarData = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const scholarData = this.scholarData();
    if (!term) return scholarData;
    return scholarData.filter((s) => s.name.toLowerCase().includes(term));
  });

  readonly allSelected = computed(
    () =>
      this.displayedScholarData().length > 0 &&
      this.displayedScholarData().every((s) =>
        this.selectedScholarIds().has(s.scholarId),
      ),
  );

  isSelected(scholarId: string): boolean {
    return this.selectedScholarIds().has(scholarId);
  }

  toggleSelection(scholarId: string, checked: boolean): void {
    const next = new Set(this.selectedScholarIds());
    if (checked) {
      next.add(scholarId);
    } else {
      next.delete(scholarId);
    }
    this.selectedScholarIds.set(next);
  }

  // Scoped to whatever's currently visible (matching the search filter), so
  // selections made under a different search term aren't silently touched.
  toggleSelectAll(checked: boolean): void {
    const next = new Set(this.selectedScholarIds());
    for (const s of this.displayedScholarData()) {
      if (checked) {
        next.add(s.scholarId);
      } else {
        next.delete(s.scholarId);
      }
    }
    this.selectedScholarIds.set(next);
  }

  async bulkDeleteSelected(): Promise<void> {
    if (this.selectedScholarIds().size === 0 || this.bulkDeleteInProgress())
      return;

    const ids = Array.from(this.selectedScholarIds());
    const confirmed = await this.confirmDialogService.confirm(
      `Are you sure you want to delete ${ids.length} scholar${ids.length === 1 ? '' : 's'}? ` +
        `This also deletes their pickup schedule and attendance records. This cannot be undone.`,
      { title: 'Delete scholars?', confirmLabel: 'Delete', variant: 'danger' },
    );
    if (!confirmed) return;

    this.bulkDeleteInProgress.set(true);

    from(ids)
      .pipe(
        concatMap((scholarId) =>
          this.scholarService.deleteScholarSilently(scholarId).pipe(
            map(() => true),
            catchError(() => of(false)),
          ),
        ),
        toArray(),
      )
      .subscribe((results) => {
        this.bulkDeleteInProgress.set(false);
        const succeeded = results.filter(Boolean).length;
        const failed = results.length - succeeded;
        this.notificationService.show(
          failed === 0
            ? `Deleted ${succeeded} scholar${succeeded === 1 ? '' : 's'}.`
            : `Deleted ${succeeded} scholar${succeeded === 1 ? '' : 's'}; ${failed} could not be deleted.`,
          failed === 0 ? 'success' : 'error',
        );
        this.data.reload();
      });
  }

  // Exports whatever is currently visible (matching the search filter), in
  // the currently sorted order — not just the selected rows.
  exportCsv(): void {
    this.csvExportService.export(
      'scholars',
      [
        { header: 'Name', value: (s: TransformedScholarData) => s.name },
        {
          header: 'School',
          value: (s: TransformedScholarData) => s.schoolName,
        },
        { header: 'Grade', value: (s: TransformedScholarData) => s.grade },
        {
          header: 'Birth Date',
          value: (s: TransformedScholarData) => s.birthDate,
        },
      ],
      this.displayedScholarData(),
    );
  }
}

function toRows(
  scholars: Scholar[],
  schools: School[],
): TransformedScholarData[] {
  const schoolsById = new Map(
    schools.map((school) => [school.schoolId.toString(), school]),
  );

  return scholars.map((scholar) => {
    const school = schoolsById.get(scholar.schoolId?.toString() ?? '');
    const schoolColor = school ? school.color : '#FFFFFF';

    return {
      scholarId: scholar.scholarId,
      name: `${scholar.firstName} ${scholar.lastName}`,
      schoolName: school ? school.name : 'Unknown',
      grade: scholar.grade,
      schoolColor,
      birthDate: parseDateOnly(scholar.birthDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      textColor: contrastTextColor(schoolColor),
    };
  });
}
