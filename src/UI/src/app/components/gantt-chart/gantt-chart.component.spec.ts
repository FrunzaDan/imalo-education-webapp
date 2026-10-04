import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { GanttChartComponent } from './gantt-chart.component';
import { ScholarService } from '../../services/scholar.service';
import { SchoolService } from '../../services/school.service';
import { Gender, Scholar } from '../../interfaces/scholar';
import type { School } from '../../interfaces/school';
import { PickupSchedule } from '../../interfaces/pickup-schedule';

const SCHOOL: School = {
  schoolId: 1,
  name: 'Scoala 1',
  color: '#000000',
  lunchPrice: 15,
  transportPrice: 10,
};

const schedule = (overrides: Partial<PickupSchedule>): PickupSchedule => ({
  monday: null,
  tuesday: null,
  wednesday: null,
  thursday: null,
  friday: null,
  ...overrides,
});

const buildScholar = (overrides: Partial<Scholar> = {}): Scholar => ({
  scholarId: 'scholar-1',
  firstName: 'Ana',
  lastName: 'Popescu',
  gender: Gender.Female,
  pickupSchedule: null,
  schoolId: 1,
  grade: 3,
  birthDate: '2018-05-01',
  motherFirstName: null,
  motherLastName: null,
  motherPhoneNumber: null,
  fatherFirstName: null,
  fatherLastName: null,
  fatherPhoneNumber: null,
  ...overrides,
});

const ANA = buildScholar({
  pickupSchedule: schedule({ monday: '12:30', tuesday: '12:10' }),
});
const BOGDAN = buildScholar({
  scholarId: 'scholar-2',
  firstName: 'Bogdan',
  schoolId: null,
  pickupSchedule: schedule({ monday: '11:00' }),
});
const CARA = buildScholar({ scholarId: 'scholar-3', firstName: 'Cara' });

async function setup(options: { loadError?: boolean } = {}) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ScholarService,
        useValue: {
          getScholars: () =>
            options.loadError
              ? throwError(() => new HttpErrorResponse({ status: 500 }))
              : of([ANA, BOGDAN, CARA]),
        },
      },
      { provide: SchoolService, useValue: { getSchools: () => of([SCHOOL]) } },
    ],
  });
  const fixture = TestBed.createComponent(GanttChartComponent);
  await fixture.whenStable();
  const component = fixture.componentInstance;
  const slot = (start: string) =>
    component.timeSlots.find((s) => s.start === start)!;
  return { fixture, component, slot };
}

describe('GanttChartComponent', () => {
  it('lays out 15-minute slots from 11:00 up to 14:00', async () => {
    const { component } = await setup();

    expect(component.timeSlots.map((s) => s.start)).toEqual([
      '11:00',
      '11:15',
      '11:30',
      '11:45',
      '12:00',
      '12:15',
      '12:30',
      '12:45',
      '13:00',
      '13:15',
      '13:30',
      '13:45',
    ]);
  });

  it('fills the slot of a pickup with its 10-minute range and school, in the school colour', async () => {
    const { component, slot } = await setup();

    expect(component.isTimeOccupied(ANA, slot('12:30'), 'monday')).toBe(true);
    expect(component.getTimeRange(ANA, slot('12:30'), 'monday')).toBe(
      '12:30 - 12:40\nScoala 1',
    );
    expect(component.getSlotStyle(ANA, slot('12:30'), 'monday')).toEqual({
      backgroundColor: '#000000',
      color: '#ffffff',
      gridColumn: 'span 1',
    });
  });

  it('leaves every other slot and day empty', async () => {
    const { component, slot } = await setup();

    expect(component.isTimeOccupied(ANA, slot('12:15'), 'monday')).toBe(false);
    expect(component.isTimeOccupied(ANA, slot('12:30'), 'wednesday')).toBe(
      false,
    );
    expect(component.getTimeRange(ANA, slot('12:15'), 'monday')).toBe('');
    expect(component.getSlotStyle(ANA, slot('12:15'), 'monday')).toEqual({});
  });

  it('does not place a pickup time that falls between slots', async () => {
    const { component } = await setup();

    expect(
      component.timeSlots.some((s) =>
        component.isTimeOccupied(ANA, s, 'tuesday'),
      ),
    ).toBe(false);
  });

  it('shows a pickup for a scholar without a school in grey as "Unknown school"', async () => {
    const { component, slot } = await setup();

    expect(component.getTimeRange(BOGDAN, slot('11:00'), 'monday')).toBe(
      '11:00 - 11:10\nUnknown school',
    );
    expect(
      component.getSlotStyle(BOGDAN, slot('11:00'), 'monday')[
        'backgroundColor'
      ],
    ).toBe('#a0a0a0');
  });

  it('renders a section per weekday with a row per scholar and the filled slots', async () => {
    const { fixture } = await setup();
    const sections = fixture.nativeElement.querySelectorAll('section');
    const monday: HTMLElement = sections[0];

    expect(sections.length).toBe(5);
    expect(monday.querySelector('h2')!.textContent).toContain('Monday');
    expect(monday.querySelectorAll('.gantt-row').length).toBe(3);
    expect(monday.querySelector('.gantt-row')!.textContent).toContain(
      '12:30 - 12:40',
    );
    expect(sections[2].querySelector('.gantt-row span')).toBeNull();
  });

  it('shows the load error instead of the chart', async () => {
    const { fixture } = await setup({ loadError: true });

    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain('Failed to load pickup times (500). Please try again.');
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });
});
