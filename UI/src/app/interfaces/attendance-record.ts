import { IsoDate } from './iso-date';

export interface AttendanceRecord {
  date: IsoDate;
  lunchCost: number;
  transportCost: number;
  present: boolean;
  lunchSelected: boolean;
  transportSelected: boolean;
}
