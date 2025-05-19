import { PickUpSchedule } from './pick-up-schedule';

export interface Scholar {
  id: string;
  firstName: string;
  lastName: string;
  pickUpSchedule: PickUpSchedule;
  schoolId: string;
  grade: number;
  birthDate: Date;
}
