import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ScholarsService } from '../../services/scholars.service';
import { AttendanceService } from '../../services/attendance.service';
import { SortingService } from '../../services/sorting.service';

interface AttendanceRow {
  scholarId: string;
  scholarName: string;
  date: string;
  lunchCost: number;
  transportCost: number;
  lunchSelected: boolean;
  transportSelected: boolean;
}

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './attendance.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './attendance.component.css',
})
export class AttendanceComponent implements OnInit {
  rows: AttendanceRow[] = [];
  loading = true;

  currentSortColumn: string = '';
  isAscending: boolean = true;

  constructor(
    private readonly scholarsService: ScholarsService,
    private readonly attendanceService: AttendanceService,
    private readonly sortingService: SortingService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    forkJoin({
      scholars: this.scholarsService.getScholars(),
      allAttendance: this.attendanceService.getAllScholarAttendance(),
    })
      .pipe(
        map(({ scholars, allAttendance }) => {
          const scholarNames = new Map(
            scholars.map((s) => [s.id, `${s.firstName} ${s.lastName}`]),
          );

          return allAttendance.flatMap((scholarAttendance) =>
            scholarAttendance.attendance.map((record) => ({
              scholarId: scholarAttendance.scholarId,
              scholarName:
                scholarNames.get(scholarAttendance.scholarId) ?? 'Unknown',
              date: record.date,
              lunchCost: record.lunchCost,
              transportCost: record.transportCost,
              lunchSelected: record.lunchSelected,
              transportSelected: record.transportSelected,
            })),
          );
        }),
      )
      .subscribe({
        next: (rows) => {
          this.rows = rows;
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to load attendance overview:', err);
          this.loading = false;
        },
      });
  }

  sortData(column: string, type: 'string' | 'number' | 'date'): void {
    if (this.currentSortColumn === column) {
      this.isAscending = !this.isAscending;
    } else {
      this.currentSortColumn = column;
      this.isAscending = true;
    }

    this.rows = this.sortingService.sort(
      this.rows,
      column as keyof AttendanceRow,
      type,
      this.isAscending,
    );
  }
}
