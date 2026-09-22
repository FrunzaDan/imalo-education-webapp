import { PickUpSchedule } from './pick-up-schedule';

export interface Scholar {
  id: string;
  firstName: string;
  lastName: string;
  pickUpSchedule: PickUpSchedule | null;
  schoolId: number | null;
  grade: number | null;
  dateOfBirth: string; // 'YYYY-MM-DD' — the API serializes DateOnly this way
  // A scholar may have a mother, a father, both, or neither — and each of a
  // parent's own fields is independently optional too.
  motherFirstName?: string | null;
  motherLastName?: string | null;
  motherPhoneNumber?: string | null;
  fatherFirstName?: string | null;
  fatherLastName?: string | null;
  fatherPhoneNumber?: string | null;
}
