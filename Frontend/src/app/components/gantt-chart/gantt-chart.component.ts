import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { TimeSlot } from '../../interfaces/time-slot';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { WeekDays } from '../../constants/week-days';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { PickUpSchedule } from '../../interfaces/pick-up-schedule';

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
  weekDays: (keyof PickUpSchedule)[] = Object.values(
    WeekDays,
  ) as (keyof PickUpSchedule)[];
  private readonly SLOT_DURATION = 10;

  constructor(
    private scholarsService: ScholarsService,
    private schoolsService: SchoolsService,
  ) {}

  ngOnInit(): void {
    this.initializeTimeSlots();
    this.loadData();
  }

  private initializeTimeSlots(): void {
    // Generate time slots from 11:00 to 14:00 with 15-minute intervals
    this.timeSlots = this.generateTimeSlots(11, 14, 15);
  }

  private loadData(): void {
    // Use forkJoin to fetch scholars and schools in parallel
    forkJoin({
      scholars: this.scholarsService.getScholars(),
      schools: this.schoolsService.getSchools(),
    })
      .pipe(
        // Map the fetched schools into a Map for easy lookup by schoolId
        map(({ scholars, schools }) => {
          this.schools = new Map(
            schools.map((school) => [school.id.toString(), school]),
          );
          return scholars; // Pass scholars to the next operator
        }),
      )
      // Subscribe to the final observable to get the scholars data
      .subscribe((scholars) => (this.scholars = scholars));
  }

  private generateTimeSlots(
    startHour: number,
    endHour: number,
    interval: number,
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

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

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
    day: keyof PickUpSchedule, // Use keyof PickUpSchedule for 'day'
  ): boolean {
    // Safely check if pickUpSchedule exists and has the 'day' property
    if (
      !scholar.pickUpSchedule ||
      typeof scholar.pickUpSchedule[day] === 'undefined'
    ) {
      return false;
    }
    const pickupTime = scholar.pickUpSchedule[day];
    // Ensure pickupTime is a string before calling timeToMinutes
    return (
      !!pickupTime &&
      typeof pickupTime === 'string' && // Add type check for pickupTime
      this.timeToMinutes(pickupTime) === this.timeToMinutes(slot.start)
    );
  }

  getSlotStyle(
    scholar: Scholar,
    slot: TimeSlot,
    day: keyof PickUpSchedule, // Use keyof PickUpSchedule for 'day'
  ): Record<string, string> {
    if (this.isSlotScheduled(scholar, slot, day)) {
      const school = this.schools.get(scholar.schoolId?.toString() ?? '');
      // Calculate column span based on SLOT_DURATION and interval (assuming 15min interval for display)
      const columnsSpan = Math.ceil(this.SLOT_DURATION / 15);

      return {
        backgroundColor: school?.color || '#a0a0a0', // Default to gray if school color is not found
        gridColumn: `span ${columnsSpan}`,
      };
    }
    return {};
  }

  getTimeRange(
    scholar: Scholar,
    slot: TimeSlot,
    day: keyof PickUpSchedule,
  ): string {
    if (this.isSlotScheduled(scholar, slot, day)) {
      // We already know pickUpSchedule is not null and has 'day' property due to isSlotScheduled check
      const pickupTime = scholar.pickUpSchedule![day]!; // Non-null: checked by isSlotScheduled (typeof === 'string')
      const school = this.schools.get(scholar.schoolId?.toString() ?? '');
      return `${pickupTime} - ${this.calculateEndTime(pickupTime)}\n${
        school?.name || 'Unknown School'
      }`;
    }
    return '';
  }

  isTimeOccupied(
    scholar: Scholar,
    slot: TimeSlot,
    day: keyof PickUpSchedule,
  ): boolean {
    return this.isSlotScheduled(scholar, slot, day);
  }

  formatDayTitle(day: string): string {
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
}
