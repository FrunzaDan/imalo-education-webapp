import { environment } from '../../../environments/environment';
import {
  max,
  maxLength,
  min,
  pattern,
  required,
  schema,
  validate,
} from '@angular/forms/signals';
import { WEEK_DAYS, WeekDay } from '../../constants/week-days';
import { Scholar } from '../../interfaces/scholar';
import { parseDateOnly } from '../../utils/weekday-dates';

export interface ScholarFormModel {
  firstName: string;
  lastName: string;
  schoolId: string;
  grade: number | null;
  birthDate: string;
  motherFirstName: string;
  motherLastName: string;
  motherPhoneNumber: string;
  fatherFirstName: string;
  fatherLastName: string;
  fatherPhoneNumber: string;
  pickupSchedule: PickUpScheduleFormModel;
}

export type PickUpScheduleFormModel = Record<WeekDay, string>;

export const emptyScholarForm = (): ScholarFormModel => ({
  firstName: '',
  lastName: '',
  schoolId: '',
  grade: null,
  birthDate: '',
  motherFirstName: '',
  motherLastName: '',
  motherPhoneNumber: '',
  fatherFirstName: '',
  fatherLastName: '',
  fatherPhoneNumber: '',
  pickupSchedule: {
    monday: '',
    tuesday: '',
    wednesday: '',
    thursday: '',
    friday: '',
  },
});

export const PHONE_PATTERN = new RegExp(environment.phoneNumberRegex);

const NAME_MAX_LENGTH = 100;

export const scholarFormSchema = schema<ScholarFormModel>((p) => {
  required(p.firstName, { message: 'First name is required.' });
  maxLength(p.firstName, NAME_MAX_LENGTH, {
    message: `First name can't exceed ${NAME_MAX_LENGTH} characters.`,
  });
  required(p.lastName, { message: 'Last name is required.' });
  maxLength(p.lastName, NAME_MAX_LENGTH, {
    message: `Last name can't exceed ${NAME_MAX_LENGTH} characters.`,
  });

  required(p.schoolId, { message: 'School is required.' });

  required(p.grade, { message: 'Grade is required.' });
  min(p.grade, 0, { message: 'Grade must be between 0 and 12.' });
  max(p.grade, 12, { message: 'Grade must be between 0 and 12.' });

  required(p.birthDate, { message: 'Birth date is required.' });
  validate(p.birthDate, ({ value }) => {
    if (!value()) return undefined;
    const date = parseDateOnly(value());
    return isNaN(date.getTime()) || date > new Date()
      ? {
          kind: 'invalidDate',
          message: 'Please enter a valid date (not in the future).',
        }
      : undefined;
  });

  for (const parent of [
    [p.motherFirstName, p.motherLastName, p.motherPhoneNumber],
    [p.fatherFirstName, p.fatherLastName, p.fatherPhoneNumber],
  ]) {
    const [firstName, lastName, phoneNumber] = parent;
    maxLength(firstName, NAME_MAX_LENGTH, {
      message: `First name can't exceed ${NAME_MAX_LENGTH} characters.`,
    });
    maxLength(lastName, NAME_MAX_LENGTH, {
      message: `Last name can't exceed ${NAME_MAX_LENGTH} characters.`,
    });
    pattern(phoneNumber, PHONE_PATTERN, {
      message: 'Not a valid phone number.',
    });
  }
});

export function isScholarFormDirty(
  model: ScholarFormModel,
  baseline: ScholarFormModel,
): boolean {
  const { pickupSchedule, ...fields } = model;
  return (
    (Object.keys(fields) as (keyof typeof fields)[]).some(
      (key) => fields[key] !== baseline[key],
    ) ||
    (Object.keys(pickupSchedule) as (keyof PickUpScheduleFormModel)[]).some(
      (day) => pickupSchedule[day] !== baseline.pickupSchedule[day],
    )
  );
}

export function toFormModel(scholar: Scholar): ScholarFormModel {
  return {
    firstName: scholar.firstName,
    lastName: scholar.lastName,
    schoolId: scholar.schoolId?.toString() ?? '',
    grade: scholar.grade,
    birthDate: scholar.birthDate ?? '',
    motherFirstName: scholar.motherFirstName ?? '',
    motherLastName: scholar.motherLastName ?? '',
    motherPhoneNumber: scholar.motherPhoneNumber ?? '',
    fatherFirstName: scholar.fatherFirstName ?? '',
    fatherLastName: scholar.fatherLastName ?? '',
    fatherPhoneNumber: scholar.fatherPhoneNumber ?? '',
    pickupSchedule: mapWeekDays((day) => scholar.pickupSchedule?.[day] ?? ''),
  };
}

export function toScholar(
  model: ScholarFormModel,
  scholarId: string | null,
): Scholar {
  return {
    scholarId: scholarId ?? '00000000-0000-0000-0000-000000000000',
    firstName: model.firstName,
    lastName: model.lastName,
    schoolId: Number(model.schoolId),
    grade: model.grade,
    birthDate: model.birthDate,
    motherFirstName: model.motherFirstName || null,
    motherLastName: model.motherLastName || null,
    motherPhoneNumber: model.motherPhoneNumber || null,
    fatherFirstName: model.fatherFirstName || null,
    fatherLastName: model.fatherLastName || null,
    fatherPhoneNumber: model.fatherPhoneNumber || null,
    pickupSchedule: mapWeekDays((day) => model.pickupSchedule[day] || null),
  };
}

function mapWeekDays<T>(valueFor: (day: WeekDay) => T): Record<WeekDay, T> {
  return Object.fromEntries(
    WEEK_DAYS.map((day) => [day, valueFor(day)]),
  ) as Record<WeekDay, T>;
}
