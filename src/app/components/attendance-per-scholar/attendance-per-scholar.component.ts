import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ScholarsService } from '../../services/scholars.service';
import { Scholar } from '../../interfaces/scholar';
import { FormsModule } from '@angular/forms';

interface AttendanceRecord {
  date: string;
  lunchCost: number;
  transportCost: number;
  selectedLunch?: boolean;
  selectedTransport?: boolean;
}

@Component({
  selector: 'app-attendance-per-scholar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance-per-scholar.component.html',
  styleUrl: './attendance-per-scholar.component.css',
})
export class AttendancePerScholarComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly scholarsService = inject(ScholarsService);

  scholar!: Scholar | null;
  attendance: AttendanceRecord[] = [];
  selectedMonth: string = '';
  availableMonths: string[] = [];

  selectedLunchTotal = 0;
  selectedTransportTotal = 0;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.scholarsService.getScholars().subscribe((scholars) => {
      this.scholar = scholars.find((s) => s.id === id) || null;

      if (this.scholar) {
        this.attendance = this.getMockAttendanceData();
        this.availableMonths = [
          ...new Set(
            this.attendance.map((a) =>
              new Date(a.date).toLocaleString('default', {
                month: 'long',
                year: 'numeric',
              }),
            ),
          ),
        ];
        this.selectedMonth = this.availableMonths[0];
        this.updateTotals();
      }
    });
  }

  filteredAttendance(): AttendanceRecord[] {
    return this.attendance.filter((a) => {
      const date = new Date(a.date);
      const monthLabel = date.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      });
      return monthLabel === this.selectedMonth;
    });
  }

  updateTotals(): void {
    const filtered = this.filteredAttendance();
    this.selectedLunchTotal = filtered
      .filter((r) => r.selectedLunch)
      .reduce((sum, r) => sum + r.lunchCost, 0);

    this.selectedTransportTotal = filtered
      .filter((r) => r.selectedTransport)
      .reduce((sum, r) => sum + r.transportCost, 0);
  }

  syncSelection(
    record: AttendanceRecord,
    type: 'lunch' | 'transport' | 'both',
    event?: Event,
  ): void {
    if (type === 'both' && event) {
      const input = event.target as HTMLInputElement;
      const checked = input.checked;
      record.selectedLunch = checked;
      record.selectedTransport = checked;
    }

    this.updateTotals();
  }

  private getMockAttendanceData(): AttendanceRecord[] {
    return [
      { date: '2024-09-01', lunchCost: 5, transportCost: 3 },
      { date: '2024-09-02', lunchCost: 5, transportCost: 3 },
      { date: '2024-09-03', lunchCost: 0, transportCost: 3 },
      { date: '2024-09-04', lunchCost: 5, transportCost: 0 },
      { date: '2024-09-05', lunchCost: 5, transportCost: 3 },
      { date: '2024-10-01', lunchCost: 5, transportCost: 3 },
    ];
  }
}
