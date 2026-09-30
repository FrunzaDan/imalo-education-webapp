import { PickupSchedule } from '../../interfaces/pickup-schedule';
import { Gender, Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import {
  todayWeekdayKey,
  todaysPickups,
  upcomingBirthdays,
} from './dashboard-data';

describe('dashboard-data', () => {
  const MONDAY = new Date(2026, 8, 28);

  const schedule = (monday: string | null): PickupSchedule => ({
    monday,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
  });

  const buildScholar = (overrides: Partial<Scholar> = {}): Scholar => ({
    scholarId: 'scholar-1',
    firstName: 'Ana',
    lastName: 'Ion',
    gender: Gender.Female,
    pickupSchedule: null,
    schoolId: null,
    grade: 1,
    birthDate: '2018-01-01',
    motherFirstName: null,
    motherLastName: null,
    motherPhoneNumber: null,
    fatherFirstName: null,
    fatherLastName: null,
    fatherPhoneNumber: null,
    ...overrides,
  });

  const school: School = {
    schoolId: 1,
    name: 'Scoala 1',
    color: '#ff0000',
    lunchPrice: 15,
    transportPrice: 5,
  };

  describe('todayWeekdayKey', () => {
    it('maps Monday to Friday to their schedule keys', () => {
      expect(todayWeekdayKey(MONDAY)).toBe('monday');
      expect(todayWeekdayKey(new Date(2026, 9, 2))).toBe('friday');
    });

    it('has no key at the weekend', () => {
      expect(todayWeekdayKey(new Date(2026, 9, 3))).toBeNull();
      expect(todayWeekdayKey(new Date(2026, 9, 4))).toBeNull();
    });
  });

  describe('todaysPickups', () => {
    it("lists today's pickups by time, with each scholar's school", () => {
      const pickups = todaysPickups(
        [
          buildScholar({
            scholarId: 'late',
            firstName: 'Maria',
            pickupSchedule: schedule('13:30'),
            schoolId: 1,
          }),
          buildScholar({
            scholarId: 'early',
            pickupSchedule: schedule('11:15'),
          }),
        ],
        [school],
        MONDAY,
      );

      expect(pickups).toEqual([
        {
          scholarId: 'early',
          name: 'Ana Ion',
          time: '11:15',
          schoolName: 'Unknown',
          schoolColor: '#a0a0a0',
        },
        {
          scholarId: 'late',
          name: 'Maria Ion',
          time: '13:30',
          schoolName: 'Scoala 1',
          schoolColor: '#ff0000',
        },
      ]);
    });

    it('skips scholars with no schedule or no pickup today', () => {
      const pickups = todaysPickups(
        [
          buildScholar({ pickupSchedule: null }),
          buildScholar({ pickupSchedule: schedule(null) }),
        ],
        [school],
        MONDAY,
      );

      expect(pickups).toEqual([]);
    });

    it('has nothing to show at the weekend', () => {
      const pickups = todaysPickups(
        [buildScholar({ pickupSchedule: schedule('12:00') })],
        [school],
        new Date(2026, 9, 3),
      );

      expect(pickups).toEqual([]);
    });
  });

  describe('upcomingBirthdays', () => {
    const born = (scholarId: string, birthDate: string) =>
      buildScholar({ scholarId, birthDate });

    it('includes birthdays from today up to 30 days ahead, soonest first', () => {
      const birthdays = upcomingBirthdays(
        [
          born('in-30', '2018-10-28'),
          born('today', '2018-09-28'),
          born('in-31', '2018-10-29'),
          born('yesterday', '2018-09-27'),
        ],
        MONDAY,
      );

      expect(birthdays.map((b) => [b.scholarId, b.daysUntil])).toEqual([
        ['today', 0],
        ['in-30', 30],
      ]);
      expect(birthdays[0]).toMatchObject({ date: '2026-09-28', turningAge: 8 });
    });

    it('wraps into next year, counting the age there', () => {
      const [birthday] = upcomingBirthdays(
        [born('new-year', '2019-01-05')],
        new Date(2026, 11, 20),
      );

      expect(birthday).toMatchObject({
        date: '2027-01-05',
        daysUntil: 16,
        turningAge: 8,
      });
    });

    it('counts whole days even when the clocks change in between', () => {
      const [birthday] = upcomingBirthdays(
        [born('after-dst', '2018-10-27')],
        new Date(2026, 9, 20, 23, 30),
      );

      expect(birthday.daysUntil).toBe(7);
    });

    it('respects a custom window and skips scholars without a birth date', () => {
      const birthdays = upcomingBirthdays(
        [born('in-5', '2018-10-03'), born('none', '')],
        MONDAY,
        3,
      );

      expect(birthdays).toEqual([]);
    });
  });
});
