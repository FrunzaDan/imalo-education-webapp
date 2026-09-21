import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { SortingService } from '../../services/sorting.service';
import { CsvExportService } from '../../services/csv-export.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmModalService } from '../../services/confirm-modal.service';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { NgStyle } from '@angular/common';
import { forkJoin, from, of } from 'rxjs';
import { catchError, concatMap, map, toArray } from 'rxjs/operators';
import { RouterModule } from '@angular/router';
import { contrastTextColor } from '../../utils/contrast-color';

interface TransformedScholarData {
  id: string;
  name: string;
  schoolName: string;
  grade: number | null;
  schoolColor: string;
  birthDate: string;
  textColor: string;
}

@Component({
  imports: [FormField, NgStyle, RouterModule],
  selector: 'app-scholar-table',
  templateUrl: './scholar-table.component.html',
  styleUrl: './scholar-table.component.css',
})
export class ScholarTableComponent implements OnInit {
  private readonly scholarsService = inject(ScholarsService);
  private readonly schoolsService = inject(SchoolsService);
  private readonly sortingService = inject(SortingService);
  private readonly csvExportService = inject(CsvExportService);
  private readonly notificationService = inject(NotificationService);
  private readonly confirmModalService = inject(ConfirmModalService);

  scholars: Scholar[] = [];
  schools: Map<string, School> = new Map();
  scholarData = signal<TransformedScholarData[]>([]);

  currentSortColumn: string = '';
  isAscending: boolean = true;

  // A one-field signal form for the search box; searchTerm is its value.
  readonly searchForm = form(signal({ term: '' }));
  readonly searchTerm = computed(() => this.searchForm.term().value());

  selectedIds = signal<Set<string>>(new Set());
  bulkDeleteInProgress = signal(false);

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    forkJoin({
      scholars: this.scholarsService.getScholars(),
      schools: this.schoolsService.getSchools(),
    })
      .pipe(
        map(({ scholars, schools }) => {
          const schoolsMap = new Map(
            schools.map((school) => [school.id.toString(), school]),
          );

          return scholars.map((scholar) => {
            const school = schoolsMap.get(scholar.schoolId?.toString() ?? '');
            const schoolName = school ? school.name : 'Unknown';
            const schoolColor = school ? school.color : '#FFFFFF';
            const textColor = contrastTextColor(schoolColor);

            return {
              id: scholar.id,
              name: `${scholar.firstName} ${scholar.lastName}`,
              schoolName,
              grade: scholar.grade,
              schoolColor,
              birthDate: new Date(scholar.dateOfBirth).toLocaleDateString(
                'en-GB',
                {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                },
              ),
              textColor,
            };
          });
        }),
      )
      .subscribe((transformedData: TransformedScholarData[]) => {
        this.scholarData.set(transformedData);
        // Stale selections (from before a reload) would otherwise reference
        // rows that may no longer exist or may have shifted.
        this.selectedIds.set(new Set());
      });
  }

  sortData(column: string, type: 'string' | 'number' | 'date'): void {
    if (this.currentSortColumn === column) {
      this.isAscending = !this.isAscending;
    } else {
      this.currentSortColumn = column;
      this.isAscending = true;
    }

    this.scholarData.set(
      this.sortingService.sort(
        this.scholarData(),
        column as keyof TransformedScholarData,
        type,
        this.isAscending,
      ),
    );
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
      this.displayedScholarData().every((s) => this.selectedIds().has(s.id)),
  );

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelection(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selectedIds.set(next);
  }

  // Scoped to whatever's currently visible (matching the search filter), so
  // selections made under a different search term aren't silently touched.
  toggleSelectAll(checked: boolean): void {
    const next = new Set(this.selectedIds());
    for (const s of this.displayedScholarData()) {
      if (checked) {
        next.add(s.id);
      } else {
        next.delete(s.id);
      }
    }
    this.selectedIds.set(next);
  }

  async bulkDeleteSelected(): Promise<void> {
    if (this.selectedIds().size === 0 || this.bulkDeleteInProgress()) return;

    const ids = Array.from(this.selectedIds());
    const confirmed = await this.confirmModalService.confirm(
      `Are you sure you want to delete ${ids.length} scholar${ids.length === 1 ? '' : 's'}? ` +
        `This also deletes their pickup schedule and attendance records. This cannot be undone.`,
      { title: 'Delete scholars', confirmText: 'Delete', variant: 'danger' },
    );
    if (!confirmed) return;

    this.bulkDeleteInProgress.set(true);

    from(ids)
      .pipe(
        concatMap((id) =>
          this.scholarsService.deleteScholar(id).pipe(
            map(() => true),
            catchError((err) => {
              console.error(`Failed to delete scholar ${id}:`, err);
              return of(false);
            }),
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
            : `Deleted ${succeeded} scholar${succeeded === 1 ? '' : 's'} (${failed} failed — check console).`,
          failed === 0 ? 'success' : 'error',
        );
        this.loadData();
      });
  }

  // Exports whatever is currently visible (matching the search filter), in
  // the currently sorted order — not just the selected rows.
  exportCsv(): void {
    this.csvExportService.export(
      'scholars',
      [
        { header: 'Name', value: (s: TransformedScholarData) => s.name },
        { header: 'School', value: (s: TransformedScholarData) => s.schoolName },
        { header: 'Grade', value: (s: TransformedScholarData) => s.grade },
        { header: 'Birth Date', value: (s: TransformedScholarData) => s.birthDate },
      ],
      this.displayedScholarData(),
    );
  }
}
