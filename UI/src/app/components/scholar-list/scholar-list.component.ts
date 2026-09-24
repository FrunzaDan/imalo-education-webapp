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
import {
  SortDirection,
  SortType,
  SortingService,
} from '../../services/sorting.service';
import { CsvExportService } from '../../services/csv-export.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { NgStyle } from '@angular/common';
import { forkJoin, from, of } from 'rxjs';
import { catchError, concatMap, map, toArray } from 'rxjs/operators';
import { RouterLink } from '@angular/router';
import { contrastTextColor } from '../../utils/contrast-color';
import { parseDateOnly } from '../../utils/weekday-dates';
import { extractErrorMessage } from '../../utils/extract-error-message';

interface ScholarRow {
  scholarId: string;
  name: string;
  schoolName: string;
  grade: number | null;
  schoolColor: string;
  birthDate: string;
  birthDateLabel: string;
  textColor: string;
}

type SortColumn = 'name' | 'schoolName' | 'grade' | 'birthDate';

const SORT_TYPES: Record<SortColumn, SortType> = {
  name: 'string',
  schoolName: 'string',
  grade: 'number',
  birthDate: 'date',
};

const SORT_LABELS: Record<SortColumn, string> = {
  name: 'student name',
  schoolName: 'school',
  grade: 'grade',
  birthDate: 'birth date',
};

@Component({
  imports: [FormField, NgStyle, RouterLink],
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

  private readonly data = rxResource({
    stream: () =>
      forkJoin({
        scholars: this.scholarService.getScholars(),
        schools: this.schoolService.getSchools(),
      }),
  });
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

  readonly sortColumn = signal<SortColumn | null>(null);
  readonly sortDirection = signal<SortDirection>('asc');

  readonly sortedRows = computed(() => {
    const column = this.sortColumn();
    return column
      ? this.sortingService.sort(
          this.rows(),
          column,
          SORT_TYPES[column],
          this.sortDirection(),
        )
      : this.rows();
  });

  readonly searchForm = form(signal({ term: '' }));
  readonly searchTerm = computed(() => this.searchForm.term().value());

  readonly selectedScholarIds = linkedSignal<ScholarRow[], ReadonlySet<string>>(
    {
      source: this.rows,
      computation: () => new Set(),
    },
  );
  readonly bulkActionInProgress = signal(false);

  setSort(column: SortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  ariaSort(column: SortColumn): 'ascending' | 'descending' | 'none' {
    if (this.sortColumn() !== column) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  readonly visibleRows = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const sortedRows = this.sortedRows();
    if (!term) return sortedRows;
    return sortedRows.filter((s) => s.name.toLowerCase().includes(term));
  });

  readonly resultsAnnouncement = computed(() => {
    if (this.loading()) return 'Loading scholars';
    const total = this.visibleRows().length;
    return `${total} ${total === 1 ? 'scholar' : 'scholars'} found`;
  });

  readonly tableCaption = computed(() => {
    const column = this.sortColumn();
    return column
      ? `Scholars, sorted by ${SORT_LABELS[column]} ${this.sortDirection() === 'asc' ? 'ascending' : 'descending'}`
      : 'Scholars';
  });

  readonly allSelected = computed(
    () =>
      this.visibleRows().length > 0 &&
      this.visibleRows().every((s) =>
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

  toggleSelectAll(checked: boolean): void {
    const next = new Set(this.selectedScholarIds());
    for (const s of this.visibleRows()) {
      if (checked) {
        next.add(s.scholarId);
      } else {
        next.delete(s.scholarId);
      }
    }
    this.selectedScholarIds.set(next);
  }

  async bulkDeleteSelected(): Promise<void> {
    if (this.selectedScholarIds().size === 0 || this.bulkActionInProgress())
      return;

    const ids = Array.from(this.selectedScholarIds());
    const confirmed = await this.confirmDialogService.confirm(
      `Are you sure you want to delete ${ids.length} scholar${ids.length === 1 ? '' : 's'}? ` +
        `This also deletes their pickup schedule and attendance records. This cannot be undone.`,
      { title: 'Delete scholars?', confirmLabel: 'Delete', variant: 'danger' },
    );
    if (!confirmed) return;

    this.bulkActionInProgress.set(true);

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
        this.bulkActionInProgress.set(false);
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

  exportCsv(): void {
    this.csvExportService.export(
      'scholars',
      [
        { header: 'Name', value: (s: ScholarRow) => s.name },
        {
          header: 'School',
          value: (s: ScholarRow) => s.schoolName,
        },
        { header: 'Grade', value: (s: ScholarRow) => s.grade },
        {
          header: 'Birth Date',
          value: (s: ScholarRow) => s.birthDateLabel,
        },
      ],
      this.visibleRows(),
    );
  }
}

function toRows(scholars: Scholar[], schools: School[]): ScholarRow[] {
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
      birthDate: scholar.birthDate,
      birthDateLabel: parseDateOnly(scholar.birthDate).toLocaleDateString(
        'en-GB',
        { day: '2-digit', month: 'short', year: 'numeric' },
      ),
      textColor: contrastTextColor(schoolColor),
    };
  });
}
