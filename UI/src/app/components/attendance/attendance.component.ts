import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RonPipe } from '../../pipes/ron.pipe';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ScholarsService } from '../../services/scholars.service';
import { AttendanceService } from '../../services/attendance.service';
import { SortingService } from '../../services/sorting.service';
import { CsvExportService } from '../../services/csv-export.service';

interface AttendanceRow {
  scholarId: string;
  scholarName: string;
  date: string;
  lunchCost: number;
  transportCost: number;
  present: boolean;
  lunchSelected: boolean;
  transportSelected: boolean;
}

@Component({
  selector: 'app-attendance',
  imports: [DatePipe, RonPipe, RouterModule],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.css',
})
export class AttendanceComponent implements OnInit {
  private readonly scholarsService = inject(ScholarsService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly sortingService = inject(SortingService);
  private readonly csvExportService = inject(CsvExportService);

  rows = signal<AttendanceRow[]>([]);
  loading = signal(true);

  currentSortColumn: string = '';
  isAscending: boolean = true;

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
              present: record.present,
              lunchSelected: record.lunchSelected,
              transportSelected: record.transportSelected,
            })),
          );
        }),
      )
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load attendance overview:', err);
          this.loading.set(false);
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

    this.rows.set(
      this.sortingService.sort(
        this.rows(),
        column as keyof AttendanceRow,
        type,
        this.isAscending,
      ),
    );
  }

  exportCsv(): void {
    this.csvExportService.export(
      'attendance',
      [
        { header: 'Scholar', value: (r: AttendanceRow) => r.scholarName },
        { header: 'Date', value: (r: AttendanceRow) => r.date },
        { header: 'Present', value: (r: AttendanceRow) => (r.present ? 'Yes' : 'No') },
        { header: 'Lunch Cost', value: (r: AttendanceRow) => r.lunchCost },
        { header: 'Transport Cost', value: (r: AttendanceRow) => r.transportCost },
        { header: 'Lunch Selected', value: (r: AttendanceRow) => (r.lunchSelected ? 'Yes' : 'No') },
        { header: 'Transport Selected', value: (r: AttendanceRow) => (r.transportSelected ? 'Yes' : 'No') },
      ],
      this.rows(),
    );
  }
}
