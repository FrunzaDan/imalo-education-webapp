import { IsoDate } from './iso-date';

export interface AttendanceRecord {
  date: IsoDate;
  lunchCost: number;
  transportCost: number;
  // Whether the scholar was present that day. Lunch/Transport can only be
  // selected while this is true.
  present: boolean;
  lunchSelected: boolean;
  transportSelected: boolean;
}
