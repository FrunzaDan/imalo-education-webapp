import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { TimeSlot } from '../../interfaces/time-slot';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { forkJoin } from 'rxjs';
import { WeekDays } from '../../constants/week-days';

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
  weekDays = Object.values(WeekDays);
  private readonly SLOT_DURATION = 30; // in minutes

  constructor(
    private scholarsService: ScholarsService,
    private schoolService: SchoolsService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    forkJoin({
      scholars: this.scholarsService.getScholars(),
      schools: this.schoolService.getSchools(),
    }).subscribe(({ scholars, schools }) => {
      this.scholars = scholars;
      // Ensure we're using string IDs consistently
      this.schools = new Map(
        schools.map((school) => [school.id.toString(), school])
      );
    });
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

  private findSchedule(
    person: Scholar,
    slot: TimeSlot,
    day: WeekDays
  ): boolean {
    const pickupTime = person.pickUpSchedule[day];
    return (
      !!pickupTime &&
      this.timeToMinutes(pickupTime) === this.timeToMinutes(slot.start)
    );
  }

  getSlotStyle(person: Scholar, slot: TimeSlot, day: WeekDays): any {
    const hasSchedule = this.findSchedule(person, slot, day);
    if (hasSchedule) {
      const schoolId = person.schoolId.toString(); // Ensure string comparison
      const school = this.schools.get(schoolId);

      // Add console.log for debugging
      console.log(
        'SchoolId:',
        schoolId,
        'School:',
        school,
        'Color:',
        school?.color
      );

      return {
        backgroundColor: school?.color || '#gray',
        gridColumn: 'span 2',
      };
    }
    return {};
  }

  getTimeRange(person: Scholar, slot: TimeSlot, day: WeekDays): string {
    const pickupTime = person.pickUpSchedule[day];
    return this.findSchedule(person, slot, day)
      ? `${pickupTime} - ${this.calculateEndTime(pickupTime)}`
      : '';
  }

  isTimeOccupied(person: Scholar, slot: TimeSlot, day: WeekDays): boolean {
    return this.findSchedule(person, slot, day);
  }

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

  formatDayTitle(day: string): string {
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
}
