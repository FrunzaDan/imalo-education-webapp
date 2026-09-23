import { WeekDay } from '../constants/week-days';

// One entry per school day: a 24-hour 'HH:mm' pickup time, or null for none.
// The API always sends all five days.
export type PickupSchedule = Record<WeekDay, string | null>;
