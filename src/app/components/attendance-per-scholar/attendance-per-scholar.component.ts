import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common'; // Import CurrencyPipe and DatePipe
import { ScholarsService } from '../../services/scholars.service';
import { Scholar } from '../../interfaces/scholar';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs'; // Import Subscription for managing subscriptions

interface AttendanceRecord {
  date: string;
  lunchCost: number;
  transportCost: number;
  selectedLunch: boolean; // Initialize to false by default
  selectedTransport: boolean; // Initialize to false by default
}

@Component({
  selector: 'app-attendance-per-scholar',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe], // Add CurrencyPipe and DatePipe to imports
  templateUrl: './attendance-per-scholar.component.html',
  styleUrl: './attendance-per-scholar.component.css',
})
export class AttendancePerScholarComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly scholarsService = inject(ScholarsService);
  private scholarSubscription: Subscription | undefined;

  scholar: Scholar | null = null;
  allAttendanceRecords: AttendanceRecord[] = [];
  filteredMonthAttendance: AttendanceRecord[] = [];
  availableMonths: string[] = [];
  selectedMonth: string = '';

  totalSelectedLunchCost: number = 0;
  totalSelectedTransportCost: number = 0;

  ngOnInit(): void {
    const scholarId = this.route.snapshot.paramMap.get('id');
    if (!scholarId) {
      console.error('Scholar ID not found in route parameters.');
      return;
    }

    this.scholarSubscription = this.scholarsService.getScholars().subscribe({
      next: (scholars) => {
        this.scholar = scholars.find((s) => s.id === scholarId) || null;

        if (this.scholar) {
          this.allAttendanceRecords = this.getMockAttendanceData();
          this.initializeAttendanceSelections();

          this.availableMonths = [
            ...new Set(
              this.allAttendanceRecords.map((record) =>
                new Date(record.date).toLocaleString('default', {
                  month: 'long',
                  year: 'numeric',
                }),
              ),
            ),
          ];

          if (this.availableMonths.length > 0) {
            this.selectedMonth = this.availableMonths[0];
            this.filterAndCalculateTotals();
          }
        } else {
          console.warn(`Scholar with ID ${scholarId} not found.`);
        }
      },
      error: (err) => {
        console.error('Error fetching scholars:', err);
      },
    });
  }

  ngOnDestroy(): void {
    if (this.scholarSubscription) {
      this.scholarSubscription.unsubscribe();
    }
  }

  private initializeAttendanceSelections(): void {
    this.allAttendanceRecords.forEach((record) => {
      record.selectedLunch = false;
      record.selectedTransport = false;
    });
  }

  filterAndCalculateTotals(): void {
    this.filteredMonthAttendance = this.allAttendanceRecords.filter(
      (record) => {
        const recordDate = new Date(record.date);
        const monthYearLabel = recordDate.toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        });
        return monthYearLabel === this.selectedMonth;
      },
    );
    this.updateTotals();
  }

  updateTotals(): void {
    this.totalSelectedLunchCost = this.filteredMonthAttendance
      .filter((record) => record.selectedLunch)
      .reduce((sum, record) => sum + record.lunchCost, 0);

    this.totalSelectedTransportCost = this.filteredMonthAttendance
      .filter((record) => record.selectedTransport)
      .reduce((sum, record) => sum + record.transportCost, 0);
  }

  syncSelection(
    record: AttendanceRecord,
    type: 'lunch' | 'transport' | 'both',
    event?: Event,
  ): void {
    if (type === 'both' && event) {
      const isChecked = (event.target as HTMLInputElement).checked;
      record.selectedLunch = isChecked;
      record.selectedTransport = isChecked;
    } else if (type === 'lunch') {
      if (!record.selectedLunch) {
        record.selectedTransport = false;
      }
    } else if (type === 'transport') {
      if (!record.selectedTransport) {
        record.selectedLunch = false;
      }
    }
    this.updateTotals();
  }

  trackByAttendanceRecord(index: number, record: AttendanceRecord): string {
    return record.date;
  }

  private getMockAttendanceData(): AttendanceRecord[] {
    return [
      {
        date: '2024-09-01',
        lunchCost: 5,
        transportCost: 3,
        selectedLunch: false,
        selectedTransport: false,
      },
      {
        date: '2024-09-02',
        lunchCost: 5,
        transportCost: 3,
        selectedLunch: false,
        selectedTransport: false,
      },
      {
        date: '2024-09-03',
        lunchCost: 0,
        transportCost: 3,
        selectedLunch: false,
        selectedTransport: false,
      },
      {
        date: '2024-09-04',
        lunchCost: 5,
        transportCost: 0,
        selectedLunch: false,
        selectedTransport: false,
      },
      {
        date: '2024-09-05',
        lunchCost: 5,
        transportCost: 3,
        selectedLunch: false,
        selectedTransport: false,
      },
      {
        date: '2024-10-01',
        lunchCost: 5,
        transportCost: 3,
        selectedLunch: false,
        selectedTransport: false,
      },
      {
        date: '2024-10-02',
        lunchCost: 6,
        transportCost: 4,
        selectedLunch: false,
        selectedTransport: false,
      },
      {
        date: '2024-11-15',
        lunchCost: 7,
        transportCost: 5,
        selectedLunch: false,
        selectedTransport: false,
      },
    ];
  }
}
