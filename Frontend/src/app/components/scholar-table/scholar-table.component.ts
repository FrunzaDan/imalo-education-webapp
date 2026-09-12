import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { SortingService } from '../../services/sorting.service';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { CommonModule } from '@angular/common';
import { forkJoin, from, of } from 'rxjs';
import { catchError, concatMap, map, toArray } from 'rxjs/operators';
import { RouterModule } from '@angular/router';

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
  imports: [CommonModule, RouterModule],
  selector: 'app-scholar-table',
  templateUrl: './scholar-table.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./scholar-table.component.css'],
})
export class ScholarTableComponent implements OnInit {
  scholars: Scholar[] = [];
  schools: Map<string, School> = new Map();
  scholarData: TransformedScholarData[] = [];

  currentSortColumn: string = '';
  isAscending: boolean = true;

  searchTerm: string = '';

  selectedIds: Set<string> = new Set();
  bulkDeleteInProgress: boolean = false;

  constructor(
    private scholarsService: ScholarsService,
    private schoolsService: SchoolsService,
    private sortingService: SortingService,
  ) {}

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
            const textColor = this.getTextColor(schoolColor);

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
        this.scholarData = transformedData;
        // Stale selections (from before a reload) would otherwise reference
        // rows that may no longer exist or may have shifted.
        this.selectedIds = new Set();
      });
  }

  public getTextColor(backgroundColor: string): string {
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return brightness < 128 ? 'white' : 'black';
  }

  sortData(column: string, type: 'string' | 'number' | 'date'): void {
    if (this.currentSortColumn === column) {
      this.isAscending = !this.isAscending;
    } else {
      this.currentSortColumn = column;
      this.isAscending = true;
    }

    this.scholarData = this.sortingService.sort(
      this.scholarData,
      column as keyof TransformedScholarData,
      type,
      this.isAscending,
    );
  }

  // The full loaded/sorted list is client-side filtered by name for display —
  // this dataset is small enough that a server round-trip per keystroke (the
  // pattern Customer_Management_System uses, justified there by server-side
  // pagination) would just be unnecessary latency here.
  get displayedScholarData(): TransformedScholarData[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.scholarData;
    return this.scholarData.filter((s) => s.name.toLowerCase().includes(term));
  }

  onSearchTermChange(value: string): void {
    this.searchTerm = value;
  }

  get allSelected(): boolean {
    return (
      this.displayedScholarData.length > 0 &&
      this.displayedScholarData.every((s) => this.selectedIds.has(s.id))
    );
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleSelection(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selectedIds = next;
  }

  // Scoped to whatever's currently visible (matching the search filter), so
  // selections made under a different search term aren't silently touched.
  toggleSelectAll(checked: boolean): void {
    const next = new Set(this.selectedIds);
    for (const s of this.displayedScholarData) {
      if (checked) {
        next.add(s.id);
      } else {
        next.delete(s.id);
      }
    }
    this.selectedIds = next;
  }

  bulkDeleteSelected(): void {
    if (this.selectedIds.size === 0 || this.bulkDeleteInProgress) return;

    const ids = Array.from(this.selectedIds);
    if (
      !confirm(
        `Are you sure you want to delete ${ids.length} scholar${ids.length === 1 ? '' : 's'}? ` +
          `This also deletes their pickup schedule and attendance records. This cannot be undone.`,
      )
    ) {
      return;
    }

    this.bulkDeleteInProgress = true;

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
        this.bulkDeleteInProgress = false;
        const succeeded = results.filter(Boolean).length;
        const failed = results.length - succeeded;
        alert(
          failed === 0
            ? `Deleted ${succeeded} scholar${succeeded === 1 ? '' : 's'}.`
            : `Deleted ${succeeded} scholar${succeeded === 1 ? '' : 's'} (${failed} failed — check console).`,
        );
        this.loadData();
      });
  }
}
