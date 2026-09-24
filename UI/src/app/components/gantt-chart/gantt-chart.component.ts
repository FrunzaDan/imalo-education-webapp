import { NgStyle } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { TimeSlot } from '../../interfaces/time-slot';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { ScholarService } from '../../services/scholar.service';
import { SchoolService } from '../../services/school.service';
import { WEEK_DAYS, WeekDay } from '../../constants/week-days';
import { forkJoin } from 'rxjs';
import { contrastTextColor } from '../../utils/contrast-color';
import { extractErrorMessage } from '../../utils/extract-error-message';

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
  private readonly scholarService = inject(ScholarService);
  private readonly schoolService = inject(SchoolService);

  // Scholars and schools, fetched in parallel once per visit. hasValue()
  // guards the reads: value() throws while the resource is in error.
  private readonly data = rxResource({
    stream: () =>
      forkJoin({
        scholars: this.scholarService.getScholars(),
        schools: this.schoolService.getSchools(),
      }),
  });
  readonly scholars = computed<Scholar[]>(() =>
    this.data.hasValue() ? this.data.value().scholars : [],
  );
  // Keyed by schoolId, for the per-cell lookup below.
  private readonly schools = computed(
    () =>
      new Map<string, School>(
        (this.data.hasValue() ? this.data.value().schools : []).map(
          (school) => [school.schoolId.toString(), school],
        ),
      ),
  );
  readonly loading = this.data.isLoading;
  readonly loadError = computed(() => {
    const error = this.data.error();
    return error
      ? extractErrorMessage(
          error as HttpErrorResponse,
          'Failed to load pickup times',
        )
      : null;
  });
  timeSlots: TimeSlot[] = [];
  readonly weekDays = WEEK_DAYS;
  private readonly SLOT_DURATION = 10;
  private static readonly EMPTY_STYLE: Record<string, string> = {};
  private static readonly UNKNOWN_SCHOOL_COLOR = '#a0a0a0';

  // Built once per scholars() change instead of being recomputed per-cell on
  // every change-detection pass (this grid is days × scholars × timeSlots
  // cells, and each cell used to independently re-parse times and rebuild a
  // style object).
  private readonly cellsByKey = computed(() => {
    const map = new Map<string, GanttCell>();
    const schools = this.schools();
    const slotsByMinutes = new Map(
      this.timeSlots.map((slot) => [this.timeToMinutes(slot.start), slot]),
    );
    const columnsSpan = Math.ceil(this.SLOT_DURATION / 15);

    for (const scholar of this.scholars()) {
      if (!scholar.pickupSchedule) continue;
      const school = schools.get(scholar.schoolId?.toString() ?? '');

      for (const day of this.weekDays) {
        const pickupTime = scholar.pickupSchedule[day];
        if (!pickupTime) continue;

        const slot = slotsByMinutes.get(this.timeToMinutes(pickupTime));
        if (!slot) continue;

        const backgroundColor =
          school?.color || GanttChartComponent.UNKNOWN_SCHOOL_COLOR;

        map.set(this.cellKey(scholar.scholarId, day, slot.start), {
          style: {
            backgroundColor,
            // Black on bright fills, white on dark ones — school colors run
            // from lime/amber to near-black brown, so a fixed text color is
            // unreadable on one end or the other.
            color: contrastTextColor(backgroundColor),
            gridColumn: `span ${columnsSpan}`,
          },
          label: `${pickupTime} - ${this.calculateEndTime(pickupTime)}\n${
            school?.name || 'Unknown school'
          }`,
        });
      }
    }

    return map;
  });

  ngOnInit(): void {
    this.initializeTimeSlots();
  }

  private initializeTimeSlots(): void {
    // Generate time slots from 11:00 to 14:00 with 15-minute intervals
    this.timeSlots = this.generateTimeSlots(11, 14, 15);
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

  private cellKey(scholarId: string, day: WeekDay, slotStart: string): string {
    return `${scholarId}|${day}|${slotStart}`;
  }

  private getCell(
    scholar: Scholar,
    slot: TimeSlot,
    day: WeekDay,
  ): GanttCell | undefined {
    return this.cellsByKey().get(
      this.cellKey(scholar.scholarId, day, slot.start),
    );
  }

  getSlotStyle(
    scholar: Scholar,
    slot: TimeSlot,
    day: WeekDay,
  ): Record<string, string> {
    return (
      this.getCell(scholar, slot, day)?.style ?? GanttChartComponent.EMPTY_STYLE
    );
  }

  getTimeRange(scholar: Scholar, slot: TimeSlot, day: WeekDay): string {
    return this.getCell(scholar, slot, day)?.label ?? '';
  }

  isTimeOccupied(scholar: Scholar, slot: TimeSlot, day: WeekDay): boolean {
    return this.getCell(scholar, slot, day) !== undefined;
  }

  formatDayTitle(day: string): string {
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
}
