import { IsoDate } from './iso-date';
import { PickupSchedule } from './pickup-schedule';

export interface Scholar {
  scholarId: string;
  firstName: string;
  lastName: string;
  pickupSchedule: PickupSchedule | null;
  schoolId: number | null;
  grade: number | null;
  birthDate: IsoDate;
  // A scholar may have a mother, a father, both, or neither — and each of a
  // parent's fields can be null on its own.
  motherFirstName: string | null;
  motherLastName: string | null;
  motherPhoneNumber: string | null;
  fatherFirstName: string | null;
  fatherLastName: string | null;
  fatherPhoneNumber: string | null;
}
