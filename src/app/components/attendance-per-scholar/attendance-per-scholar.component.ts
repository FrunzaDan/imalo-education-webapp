import { Component, OnInit, inject, OnDestroy } from '@angular/core'; // Add OnDestroy
import { ActivatedRoute } from '@angular/router';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs'; // Import Subscription for managing subscriptions

// Import your services and interfaces
import { ScholarsService } from '../../services/scholars.service';
import { AttendanceService } from '../../services/attendance.service'; // <--- NEW: Import AttendanceService
import { Scholar } from '../../interfaces/scholar';
// Use the raw AttendanceRecord from your interfaces folder
import { AttendanceRecord } from '../../interfaces/attendance-record'; // <--- Ensure this is correct

// Define an interface for the records as they are displayed in the UI
// This extends the raw data with UI-specific state (checkbox selections)
interface AttendanceDisplayRecord extends AttendanceRecord {
  selectedLunch: boolean;
  selectedTransport: boolean;
}

@Component({
  selector: 'app-attendance-per-scholar',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './attendance-per-scholar.component.html',
  styleUrl: './attendance-per-scholar.component.css',
})
export class AttendancePerScholarComponent implements OnInit, OnDestroy {
  // Implement OnDestroy
  private readonly route = inject(ActivatedRoute);
  private readonly scholarsService = inject(ScholarsService);
  private readonly attendanceService = inject(AttendanceService); // <--- NEW: Inject AttendanceService

  private scholarSubscription: Subscription | undefined;
  private attendanceSubscription: Subscription | undefined; // To manage attendance subscription

  scholar: Scholar | null = null;
  allAttendanceRecords: AttendanceRecord[] = []; // Stores raw attendance data fetched from service
  filteredMonthAttendance: AttendanceDisplayRecord[] = []; // Stores records for display with UI state
  availableMonths: string[] = [];
  selectedMonth: string = '';

  totalSelectedLunchCost: number = 0;
  totalSelectedTransportCost: number = 0;
  grandTotal: number = 0; // Added for combined total

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
          this.attendanceSubscription = this.attendanceService
            .getAttendanceByScholarId(scholarId)
            .subscribe({
              next: (attendanceData: AttendanceRecord[] | undefined) => {
                if (attendanceData) {
                  this.allAttendanceRecords = attendanceData;
                  this.initializeAttendanceSelections(); // Initialize UI state on fetched data
                  this.setupMonthsAndFilter(); // Set up months and apply initial filter
                } else {
                  console.warn(
                    `No attendance data found for scholar ID: ${scholarId}`,
                  );
                  this.allAttendanceRecords = []; // Ensure empty array
                  this.filteredMonthAttendance = [];
                  this.availableMonths = []; // Clear months
                  this.selectedMonth = ''; // Clear selected month
                  this.updateTotals(); // Reset totals
                }
              },
              error: (err) => {
                console.error('Error fetching attendance data:', err);
                this.allAttendanceRecords = []; // Ensure empty array on error
                this.filteredMonthAttendance = [];
                this.availableMonths = [];
                this.selectedMonth = '';
                this.updateTotals();
              },
            });
        } else {
          console.warn(`Scholar with ID ${scholarId} not found.`);
          // Clear attendance data if scholar not found
          this.allAttendanceRecords = [];
          this.filteredMonthAttendance = [];
          this.availableMonths = [];
          this.selectedMonth = '';
          this.updateTotals();
        }
      },
      error: (err) => {
        console.error('Error fetching scholars:', err);
        // Clear all data on scholar fetch error
        this.scholar = null;
        this.allAttendanceRecords = [];
        this.filteredMonthAttendance = [];
        this.availableMonths = [];
        this.selectedMonth = '';
        this.updateTotals();
      },
    });
  }

  ngOnDestroy(): void {
    if (this.scholarSubscription) {
      this.scholarSubscription.unsubscribe();
    }
    if (this.attendanceSubscription) {
      this.attendanceSubscription.unsubscribe();
    }
  }

  private initializeAttendanceSelections(): void {
    // Map raw data to display records, adding initial selection state
    this.filteredMonthAttendance = this.allAttendanceRecords.map((record) => ({
      ...record,
      selectedLunch: record.lunchCost > 0, // Default to selected if there's a cost
      selectedTransport: record.transportCost > 0, // Default to selected if there's a cost
    }));
  }

  private setupMonthsAndFilter(): void {
    const monthsSet = new Set<string>();
    this.allAttendanceRecords.forEach((record) => {
      const date = new Date(record.date);
      const monthYear = date.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      });
      monthsSet.add(monthYear);
    });
    // Sort months chronologically
    this.availableMonths = Array.from(monthsSet).sort((a, b) => {
      const dateA = new Date(a.replace(/(\w+) (\d+)/, '$1 1, $2')); // Convert "Month Year" to "Month 1, Year" for parsing
      const dateB = new Date(b.replace(/(\w+) (\d+)/, '$1 1, $2'));
      return dateA.getTime() - dateB.getTime();
    });

    if (this.availableMonths.length > 0) {
      this.selectedMonth = this.availableMonths[0]; // Select the earliest month by default
    } else {
      this.selectedMonth = ''; // No months available
    }

    this.filterAndCalculateTotals();
  }

  filterAndCalculateTotals(): void {
    if (!this.selectedMonth) {
      this.filteredMonthAttendance = [];
    } else {
      // Filter raw data and then map to display records, preserving existing selections if possible
      this.filteredMonthAttendance = this.allAttendanceRecords
        .filter((record) => {
          const recordDate = new Date(record.date);
          const monthYearLabel = recordDate.toLocaleString('default', {
            month: 'long',
            year: 'numeric',
          });
          return monthYearLabel === this.selectedMonth;
        })
        .map((record) => {
          const existingDisplayRecord = this.filteredMonthAttendance.find(
            (displayRec) => displayRec.date === record.date,
          );
          return {
            ...record,
            selectedLunch: existingDisplayRecord
              ? existingDisplayRecord.selectedLunch
              : record.lunchCost > 0,
            selectedTransport: existingDisplayRecord
              ? existingDisplayRecord.selectedTransport
              : record.transportCost > 0,
          };
        });
    }
    this.updateTotals();
  }

  updateTotals(): void {
    this.totalSelectedLunchCost = this.filteredMonthAttendance.reduce(
      (sum, record) => sum + (record.selectedLunch ? record.lunchCost : 0),
      0,
    );

    this.totalSelectedTransportCost = this.filteredMonthAttendance.reduce(
      (sum, record) =>
        sum + (record.selectedTransport ? record.transportCost : 0),
      0,
    );

    this.grandTotal =
      this.totalSelectedLunchCost + this.totalSelectedTransportCost;
  }

  syncSelection(
    record: AttendanceDisplayRecord,
    type: 'lunch' | 'transport' | 'both',
    event?: Event,
  ): void {
    if (type === 'both' && event) {
      const isChecked = (event.target as HTMLInputElement).checked;
      record.selectedLunch = isChecked;
      record.selectedTransport = isChecked;
    } else if (type === 'lunch') {
      record.selectedLunch = !record.selectedLunch; // Toggle the state
      // If lunch is unchecked, and both were checked, uncheck transport too (optional logic)
      if (!record.selectedLunch && record.selectedTransport) {
        record.selectedTransport = false;
      }
    } else if (type === 'transport') {
      record.selectedTransport = !record.selectedTransport; // Toggle the state
      // If transport is unchecked, and both were checked, uncheck lunch too (optional logic)
      if (!record.selectedTransport && record.selectedLunch) {
        record.selectedLunch = false;
      }
    }
    this.updateTotals();
  }

  trackByAttendanceRecord(
    index: number,
    record: AttendanceDisplayRecord,
  ): string {
    return record.date;
  }
}
