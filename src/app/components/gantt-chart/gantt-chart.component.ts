import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { TimeSlot } from '../../interfaces/time-slot';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { forkJoin } from 'rxjs';

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
  timeSlots = this.generateTimeSlots();

  private readonly SLOT_DURATION = 30; // in minutes

  constructor(
    private scholarsService: ScholarsService,
    private schoolService: SchoolsService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    // Load both scholars and schools data
    forkJoin({
      scholars: this.scholarsService.getScholars(),
      schools: this.schoolService.getSchools(),
    }).subscribe(({ scholars, schools }) => {
      this.scholars = scholars;
      // Create a map of schools for easy lookup
      this.schools = new Map(schools.map((school) => [school.id, school]));
    });
  }

  // Helper to convert time string to minutes
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Helper to convert minutes to time string
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }

  // Calculate the end time of a given start time
  private calculateEndTime(start: string): string {
    return this.minutesToTime(this.timeToMinutes(start) + this.SLOT_DURATION);
  }

  // Find matching schedule for a scholar at a specific time slot
  private findSchedule(person: Scholar, slot: TimeSlot) {
    return person.pickUpSchedule.find(
      ({ monday: start }) =>
        this.timeToMinutes(start) === this.timeToMinutes(slot.start)
    );
  }

  // Get the style for a time slot for a particular scholar
  getSlotStyle(person: Scholar, slot: TimeSlot): any {
    const schedule = this.findSchedule(person, slot);
    if (schedule) {
      const school = this.schools.get(person.schoolId);
      return {
        backgroundColor: school?.color || '#gray', // Fallback color if school not found
        gridColumn: 'span 2', // Make the slot span 2 columns (30 minutes)
      };
    }
    return {};
  }

  // Get the time range for a scholar's schedule at a specific time slot
  getTimeRange(person: Scholar, slot: TimeSlot): string {
    const schedule = this.findSchedule(person, slot);
    return schedule
      ? `${schedule.monday} - ${this.calculateEndTime(schedule.monday)}`
      : '';
  }

  // Check if a time slot is occupied for a given scholar
  isTimeOccupied(person: Scholar, slot: TimeSlot): boolean {
    return !!this.findSchedule(person, slot);
  }

  // Generate the time slots for the Gantt chart
  private generateTimeSlots(): TimeSlot[] {
    const slots: TimeSlot[] = [];
    for (let hour = 11; hour < 15; hour++) {
      for (let quarter = 0; quarter < 4; quarter++) {
        const minutes = quarter * 15;
        const time = `${hour}:${minutes.toString().padStart(2, '0')}`;
        slots.push({ start: time, displayLabel: time });
      }
    }
    return slots;
  }
}
