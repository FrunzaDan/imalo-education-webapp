import { PickUpSchedule } from './schedule';

export interface Scholar {
  firstName: string;
  lastName: string;
  pickUpSchedule: PickUpSchedule[];
  schoolId: string;
}
