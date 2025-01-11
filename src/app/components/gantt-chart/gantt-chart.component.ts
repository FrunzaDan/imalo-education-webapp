import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TimeSlot } from '../../interfaces/time-slot';
import { Scholar } from '../../interfaces/scholar';

@Component({
  selector: 'app-gantt-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gantt-chart.component.html',
  styleUrls: ['./gantt-chart.component.css'], // Note: 'styleUrls' should be plural
})
export class GanttChartComponent {
  timeSlots = this.generateTimeSlots();
  colors = ['#4CAF50', '#2196F3', '#FFC107'];
  scholars: Scholar[] = [
    {
      name: 'Casandra',
      pickUpSchedule: [{ start: '11:00', color: this.colors[0] }],
    },
    {
      name: 'Lea',
      pickUpSchedule: [{ start: '12:00', color: this.colors[1] }],
    },
    {
      name: 'Alex',
      pickUpSchedule: [{ start: '11:45', color: this.colors[2] }],
    },
  ];

  private readonly SLOT_DURATION = 30; // in minutes

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
    const startMinutes = this.timeToMinutes(start);
    return this.minutesToTime(startMinutes + this.SLOT_DURATION);
  }

  private findSchedule(person: Scholar, slot: TimeSlot) {
    return person.pickUpSchedule.find(({ start }) => {
      const scheduleStartMinutes = this.timeToMinutes(start);
      const scheduleEndMinutes = scheduleStartMinutes + this.SLOT_DURATION;
      const slotStartMinutes = this.timeToMinutes(slot.start);
      const slotEndMinutes = slotStartMinutes + this.SLOT_DURATION;

      return (
        slotStartMinutes < scheduleEndMinutes &&
        slotEndMinutes > scheduleStartMinutes
      );
    });
  }

  getSlotStyle(person: Scholar, slot: TimeSlot): any {
    const schedule = this.findSchedule(person, slot);
    return schedule ? { backgroundColor: schedule.color } : {};
  }

  getTimeRange(person: Scholar, slot: TimeSlot): string {
    const schedule = this.findSchedule(person, slot);
    return schedule
      ? `${schedule.start} - ${this.calculateEndTime(schedule.start)}`
      : '';
  }

  isTimeOccupied(person: Scholar, slot: TimeSlot): boolean {
    return !!this.findSchedule(person, slot);
  }

  private generateTimeSlots(): TimeSlot[] {
    const slots: TimeSlot[] = [];
    for (let hour = 10; hour < 15; hour++) {
      for (let quarter = 0; quarter < 4; quarter++) {
        const minutes = quarter * 15;
        const time = `${hour}:${minutes.toString().padStart(2, '0')}`;
        slots.push({ start: time, displayLabel: time });
      }
    }
    return slots;
  }
}
