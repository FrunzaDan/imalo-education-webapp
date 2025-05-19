import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ScholarsService } from '../../services/scholars.service';
import { Scholar } from '../../interfaces/scholar';

interface AttendanceRecord {
  date: string;
  lunchCost: number;
  transportCost: number;
}

@Component({
  selector: 'app-attendance-per-scholar',
  imports: [CommonModule],
  templateUrl: './attendance-per-scholar.component.html',
  styleUrl: './attendance-per-scholar.component.css',
})
export class AttendancePerScholarComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly scholarsService = inject(ScholarsService);

  scholar: Scholar | null = null;
  attendance: AttendanceRecord[] = [];

  get totalLunchCost(): number {
    return this.attendance.reduce((sum, a) => sum + a.lunchCost, 0);
  }

  get totalTransportCost(): number {
    return this.attendance.reduce((sum, a) => sum + a.transportCost, 0);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.scholarsService.getScholars().subscribe((scholars) => {
      this.scholar = scholars.find((s) => s.id === id) || null;

      if (this.scholar) {
        // Replace this with real backend call in production
        this.attendance = this.getMockAttendanceData();
      }
    });
  }

  private getMockAttendanceData(): AttendanceRecord[] {
    return [
      { date: '2024-09-01', lunchCost: 5, transportCost: 3 },
      { date: '2024-09-02', lunchCost: 5, transportCost: 3 },
      { date: '2024-09-03', lunchCost: 0, transportCost: 3 },
      { date: '2024-09-04', lunchCost: 5, transportCost: 0 },
      { date: '2024-09-05', lunchCost: 5, transportCost: 3 },
    ];
  }
}
