import { PickUpSchedule } from './pick-up-schedule';

export interface Scholar {
  id: string;
  firstName: string;
  lastName: string;
  pickUpSchedule: PickUpSchedule | null;
  schoolId: string;
  grade: number;
  dateOfBirth: Date;
}
