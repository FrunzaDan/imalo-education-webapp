import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { TimeSlot } from '../../interfaces/time-slot';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { WeekDays } from '../../constants/week-days';
import { forkJoin } from 'rxjs/internal/observable/forkJoin';

@Component({
  selector: 'app-gantt-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gantt-chart.component.html',
  styleUrls: ['./gantt-chart.component.css'],
})
export class GanttChartComponent implements OnInit {
  scholars: Scholar[] = [];
  schools: Map<string, School> = new Map();
  timeSlots: TimeSlot[] = [];
  weekDays = Object.values(WeekDays);
  private readonly SLOT_DURATION = 30;

  constructor(
    private scholarsService: ScholarsService,
    private schoolsService: SchoolsService
  ) {}

  ngOnInit(): void {
    this.initializeTimeSlots();
    this.loadData();
  }

  private initializeTimeSlots(): void {
    this.timeSlots = this.generateTimeSlots(11, 15, 15);
  }

  private loadData(): void {
    forkJoin({
      scholars: this.scholarsService.getScholars(),
      schools: this.schoolsService.getSchools(),
    }).subscribe(({ scholars, schools }) => {
      this.scholars = scholars;
      this.schools = new Map(
        schools.map((school) => [school.id.toString(), school])
      );
    });
  }

  private generateTimeSlots(
    startHour: number,
    endHour: number,
    interval: number
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minutes = 0; minutes < 60; minutes += interval) {
        const time = this.formatTime(hour, minutes);
        slots.push({ start: time, displayLabel: time });
      }
    }
    return slots;
  }

  private formatTime(hours: number, minutes: number): string {
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  // Convert time string to total minutes
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Convert total minutes to time string
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }

  private calculateEndTime(start: string): string {
    return this.minutesToTime(this.timeToMinutes(start) + this.SLOT_DURATION);
  }

  private isSlotScheduled(
    scholar: Scholar,
    slot: TimeSlot,
    day: WeekDays
  ): boolean {
    const pickupTime = scholar.pickUpSchedule[day];
    return (
      !!pickupTime &&
      this.timeToMinutes(pickupTime) === this.timeToMinutes(slot.start)
    );
  }

  getSlotStyle(
    scholar: Scholar,
    slot: TimeSlot,
    day: WeekDays
  ): Record<string, string> {
    if (this.isSlotScheduled(scholar, slot, day)) {
      const school = this.schools.get(scholar.schoolId.toString());
      return {
        backgroundColor: school?.color || '#gray',
        gridColumn: 'span 2',
      };
    }
    return {};
  }

  getTimeRange(scholar: Scholar, slot: TimeSlot, day: WeekDays): string {
    const pickupTime = scholar.pickUpSchedule[day];
    if (this.isSlotScheduled(scholar, slot, day)) {
      const school = this.schools.get(scholar.schoolId.toString());
      return `${pickupTime} - ${this.calculateEndTime(pickupTime)}\n${
        school?.name || 'Unknown School'
      }`;
    }
    return '';
  }

  isTimeOccupied(scholar: Scholar, slot: TimeSlot, day: WeekDays): boolean {
    return this.isSlotScheduled(scholar, slot, day);
  }

  formatDayTitle(day: string): string {
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
}
