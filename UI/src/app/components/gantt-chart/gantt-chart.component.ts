import { NgStyle } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { TimeSlot } from '../../interfaces/time-slot';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { WeekDays } from '../../constants/week-days';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { PickUpSchedule } from '../../interfaces/pick-up-schedule';
import { contrastTextColor } from '../../utils/contrast-color';

interface GanttCell {
  style: Record<string, string>;
  label: string;
}

@Component({
  selector: 'app-gantt-chart',
  imports: [NgStyle],
  templateUrl: './gantt-chart.component.html',
  styleUrl: './gantt-chart.component.css',
})
export class GanttChartComponent implements OnInit {
  private readonly scholarsService = inject(ScholarsService);
  private readonly schoolsService = inject(SchoolsService);

  scholars = signal<Scholar[]>([]);
  schools = new Map<string, School>();
  timeSlots: TimeSlot[] = [];
  weekDays: (keyof PickUpSchedule)[] = Object.values(
    WeekDays,
  ) as (keyof PickUpSchedule)[];
  private readonly SLOT_DURATION = 10;
  private static readonly EMPTY_STYLE: Record<string, string> = {};
  private static readonly UNKNOWN_SCHOOL_COLOR = '#a0a0a0';

  // Built once per scholars() change instead of being recomputed per-cell on
  // every change-detection pass (this grid is days × scholars × timeSlots
  // cells, and each cell used to independently re-parse times and rebuild a
  // style object).
  private readonly cellsByKey = computed(() => {
    const map = new Map<string, GanttCell>();
    const slotsByMinutes = new Map(
      this.timeSlots.map((slot) => [this.timeToMinutes(slot.start), slot]),
    );
    const columnsSpan = Math.ceil(this.SLOT_DURATION / 15);

    for (const scholar of this.scholars()) {
      if (!scholar.pickUpSchedule) continue;
      const school = this.schools.get(scholar.schoolId?.toString() ?? '');

      for (const day of this.weekDays) {
        const pickupTime = scholar.pickUpSchedule[day];
        if (!pickupTime || typeof pickupTime !== 'string') continue;

        const slot = slotsByMinutes.get(this.timeToMinutes(pickupTime));
        if (!slot) continue;

        const backgroundColor =
          school?.color || GanttChartComponent.UNKNOWN_SCHOOL_COLOR;

        map.set(this.cellKey(scholar.id, day, slot.start), {
          style: {
            backgroundColor,
            // Black on bright fills, white on dark ones — school colors run
            // from lime/amber to near-black brown, so a fixed text color is
            // unreadable on one end or the other.
            color: contrastTextColor(backgroundColor),
            gridColumn: `span ${columnsSpan}`,
          },
          label: `${pickupTime} - ${this.calculateEndTime(pickupTime)}\n${
            school?.name || 'Unknown School'
          }`,
        });
      }
    }

    return map;
  });

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
      .subscribe((scholars) => this.scholars.set(scholars));
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

  private cellKey(
    scholarId: string,
    day: keyof PickUpSchedule,
    slotStart: string,
  ): string {
    return `${scholarId}|${day}|${slotStart}`;
  }

  private getCell(
    scholar: Scholar,
    slot: TimeSlot,
    day: keyof PickUpSchedule,
  ): GanttCell | undefined {
    return this.cellsByKey().get(this.cellKey(scholar.id, day, slot.start));
  }

  getSlotStyle(
    scholar: Scholar,
    slot: TimeSlot,
    day: keyof PickUpSchedule,
  ): Record<string, string> {
    return this.getCell(scholar, slot, day)?.style ?? GanttChartComponent.EMPTY_STYLE;
  }

  getTimeRange(
    scholar: Scholar,
    slot: TimeSlot,
    day: keyof PickUpSchedule,
  ): string {
    return this.getCell(scholar, slot, day)?.label ?? '';
  }

  isTimeOccupied(
    scholar: Scholar,
    slot: TimeSlot,
    day: keyof PickUpSchedule,
  ): boolean {
    return this.getCell(scholar, slot, day) !== undefined;
  }

  formatDayTitle(day: string): string {
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
}
