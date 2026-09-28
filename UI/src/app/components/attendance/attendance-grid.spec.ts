import { AttendanceRecord } from '../../interfaces/attendance-record';
import { Scholar } from '../../interfaces/scholar';
import {
  AttendanceCell,
  buildScholarRows,
  cellLabel,
  countsByDay,
  sum,
} from './attendance-grid';

describe('attendance-grid', () => {
  const MONTH = '2026-09'; // Starts on a Tuesday; 22 weekdays.

  const buildScholar = (
    scholarId: string,
    firstName: string,
    lastName: string,
  ): Scholar => ({
    scholarId,
    firstName,
    lastName,
    pickupSchedule: null,
    schoolId: 1,
    grade: 1,
    birthDate: '2018-01-01',
    motherFirstName: null,
    motherLastName: null,
    motherPhoneNumber: null,
    fatherFirstName: null,
    fatherLastName: null,
    fatherPhoneNumber: null,
  });

  const buildRecord = (
    date: string,
    overrides: Partial<AttendanceRecord> = {},
  ): AttendanceRecord => ({
    date,
    lunchCost: 0,
    transportCost: 0,
    present: true,
    lunchSelected: false,
    transportSelected: false,
    ...overrides,
  });

  const present = (
    lunchSelected = false,
    transportSelected = false,
  ): AttendanceCell => ({ present: true, lunchSelected, transportSelected });

  describe('buildScholarRows', () => {
    it('gives every scholar one cell per weekday of the month, sorted by name', () => {
      const rows = buildScholarRows(
        [buildScholar('s2', 'Maria', 'Pop'), buildScholar('s1', 'Ana', 'Ion')],
        [],
        MONTH,
      );

      expect(rows.map((r) => r.scholarName)).toEqual(['Ana Ion', 'Maria Pop']);
      expect(rows.every((r) => r.cells.length === 22)).toBe(true);
      expect(rows[0].cells.every((c) => c === null)).toBe(true);
    });

    it('puts each record in the column of its date and ignores other months', () => {
      const rows = buildScholarRows(
        [buildScholar('s1', 'Ana', 'Ion')],
        [
          {
            scholarId: 's1',
            attendance: [
              buildRecord('2026-09-02', { lunchSelected: true }),
              buildRecord('2026-08-31'),
            ],
          },
        ],
        MONTH,
      );

      const cells = rows[0].cells;
      expect(cells[0]).toBeNull();
      expect(cells[1]).toEqual(present(true));
      expect(cells.filter((c) => c !== null)).toHaveLength(1);
    });

    it('ignores attendance of scholars that are not in the list', () => {
      const rows = buildScholarRows(
        [buildScholar('s1', 'Ana', 'Ion')],
        [{ scholarId: 'gone', attendance: [buildRecord('2026-09-01')] }],
        MONTH,
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].cells[0]).toBeNull();
    });

    it('returns no columns when no month is chosen', () => {
      const rows = buildScholarRows([buildScholar('s1', 'Ana', 'Ion')], [], '');

      expect(rows[0].cells).toEqual([]);
    });
  });

  describe('cellLabel', () => {
    it.each([
      [null, ''],
      [{ present: false, lunchSelected: true, transportSelected: true }, ''],
      [present(), 'Present'],
      [present(true), 'Present + Lunch'],
      [present(true, true), 'Present + Lunch + Transport'],
      [present(false, true), 'Present + Transport'],
    ])('labels %o as "%s"', (cell, label) => {
      expect(cellLabel(cell)).toBe(label);
    });
  });

  describe('countsByDay', () => {
    it('counts only present scholars, per day and per service', () => {
      const rows = [
        {
          scholarId: 's1',
          scholarName: 'Ana Ion',
          cells: [present(true, true), present(), null],
        },
        {
          scholarId: 's2',
          scholarName: 'Maria Pop',
          cells: [
            present(true),
            { present: false, lunchSelected: true, transportSelected: true },
            null,
          ],
        },
      ];

      expect(countsByDay(rows, 3)).toEqual({
        present: [2, 1, 0],
        lunchSelected: [2, 0, 0],
        transportSelected: [1, 0, 0],
      });
    });

    it('returns zeros for every day when there are no rows', () => {
      expect(countsByDay([], 2)).toEqual({
        present: [0, 0],
        lunchSelected: [0, 0],
        transportSelected: [0, 0],
      });
    });
  });

  it('sum adds up a list of counts', () => {
    expect(sum([2, 1, 0])).toBe(3);
    expect(sum([])).toBe(0);
  });
});
