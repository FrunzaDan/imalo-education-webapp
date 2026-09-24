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
  motherFirstName: string | null;
  motherLastName: string | null;
  motherPhoneNumber: string | null;
  fatherFirstName: string | null;
  fatherLastName: string | null;
  fatherPhoneNumber: string | null;
}
