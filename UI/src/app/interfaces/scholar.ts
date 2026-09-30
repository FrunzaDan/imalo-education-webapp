import { IsoDate } from './iso-date';
import { PickupSchedule } from './pickup-schedule';

// Sent as a number, the same as in the customer and employee apps.
export enum Gender {
  NotDeclared = 0,
  Male = 1,
  Female = 2,
}

export interface Scholar {
  scholarId: string;
  firstName: string;
  lastName: string;
  gender: Gender;
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
