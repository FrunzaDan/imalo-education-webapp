import { Gender } from '../interfaces/scholar';
import { School } from '../interfaces/school';
import {
  buildRandomAttendance,
  buildRandomScholar,
  randomGender,
} from './random-scholar';

describe('randomGender', () => {
  afterEach(() => vi.restoreAllMocks());

  it('gives 46% boys, 46% girls and 8% not declared', () => {
    const genderAt = (roll: number) => {
      vi.spyOn(Math, 'random').mockReturnValue(roll);
      return randomGender();
    };

    expect(genderAt(0)).toBe(Gender.Male);
    expect(genderAt(0.459)).toBe(Gender.Male);
    expect(genderAt(0.46)).toBe(Gender.Female);
    expect(genderAt(0.919)).toBe(Gender.Female);
    expect(genderAt(0.92)).toBe(Gender.NotDeclared);
    expect(genderAt(0.999)).toBe(Gender.NotDeclared);
  });
});

describe('buildRandomScholar', () => {
  const schools: School[] = [
    {
      schoolId: 1,
      name: 'Scoala 1',
      color: '#ff0000',
      lunchPrice: 20,
      transportPrice: 7,
    },
  ];
  const today = new Date(2026, 8, 29);
  const build = (count: number) =>
    Array.from({ length: count }, () => buildRandomScholar(schools, today));

  it('puts each child in the grade for its age, give or take a year', () => {
    for (const scholar of build(300)) {
      const age =
        (today.getTime() - new Date(scholar.birthDate).getTime()) /
        (365.25 * 86_400_000);
      expect(age).toBeGreaterThanOrEqual(6.5 - 0.01);
      expect(age).toBeLessThanOrEqual(11 + 0.01);
      expect(scholar.grade).toBeGreaterThanOrEqual(1);
      expect(scholar.grade).toBeLessThanOrEqual(4);
      expect(
        Math.abs(scholar.grade! - (Math.floor(age) - 6)),
      ).toBeLessThanOrEqual(1);
    }
  });

  it('gives boys and girls names that match', () => {
    const scholars = build(300);
    const namesOf = (gender: Gender) =>
      new Set(
        scholars.filter((s) => s.gender === gender).map((s) => s.firstName),
      );
    const boys = namesOf(Gender.Male);
    const girls = namesOf(Gender.Female);

    expect(boys.size).toBeGreaterThan(10);
    expect(girls.size).toBeGreaterThan(10);
    expect([...boys].filter((name) => girls.has(name))).toEqual([]);
  });

  it('marks the child and its parents as test records after their names', () => {
    for (const scholar of build(50)) {
      const names = [
        scholar.firstName,
        scholar.lastName,
        scholar.motherFirstName,
        scholar.motherLastName,
        scholar.fatherFirstName,
        scholar.fatherLastName,
      ].filter((name) => name !== null);
      for (const name of names) expect(name).toMatch(/\STest$/);
    }
  });

  it('gives the child the surname of one of its parents', () => {
    for (const scholar of build(300)) {
      expect([scholar.fatherLastName, scholar.motherLastName]).toContain(
        scholar.lastName,
      );
    }
  });

  it('always has a mother to call, and a father only for some', () => {
    const scholars = build(300);

    for (const scholar of scholars) {
      expect(scholar.motherFirstName).toBeTruthy();
      expect(scholar.motherPhoneNumber).toMatch(/^07[2-8]\d{7}$/);
    }
    const withFather = scholars.filter((s) => s.fatherFirstName).length;
    expect(withFather).toBeGreaterThan(0);
    expect(withFather).toBeLessThan(300);
  });

  it('keeps a child mostly to its usual pickup time, with different times across children', () => {
    const schedules = build(100).map((s) => Object.values(s.pickupSchedule!));

    const withUsualTime = schedules.filter((times) =>
      times.some((t) => times.filter((other) => other === t).length >= 3),
    ).length;
    expect(withUsualTime).toBeGreaterThan(50);
    expect(new Set(schedules.map((times) => times[0])).size).toBeGreaterThan(5);
  });
});

describe('buildRandomAttendance', () => {
  it('gives each child its own habits, so how often they come varies', () => {
    const school: School = {
      schoolId: 1,
      name: 'Scoala 1',
      color: '#ff0000',
      lunchPrice: 20,
      transportPrice: 7,
    };
    const counts = Array.from(
      { length: 20 },
      () => buildRandomAttendance(school).length,
    );

    expect(Math.max(...counts) - Math.min(...counts)).toBeGreaterThan(50);
  });
});
