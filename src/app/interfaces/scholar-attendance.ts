import { AttendanceRecord } from './attendance-record';

export interface ScholarAttendance {
  scholarId: string;
  attendance: AttendanceRecord[];
}
