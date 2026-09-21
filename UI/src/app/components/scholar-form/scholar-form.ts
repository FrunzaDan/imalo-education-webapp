import {
  max,
  maxLength,
  min,
  pattern,
  required,
  schema,
  validate,
} from '@angular/forms/signals';
import { Scholar } from '../../interfaces/scholar';

// The form's own shape, kept separate from the API's Scholar: native controls
// only emit strings (or number | null for <input type="number">), so ids and
// dates live here as strings and are converted at the edges (toFormModel /
// toScholar). Optional values are '' rather than null — text inputs can't
// hold null.
export interface ScholarFormModel {
  firstName: string;
  lastName: string;
  schoolId: string; // <select> emits strings; the API wants a number (see toScholar)
  grade: number | null;
  dateOfBirth: string; // 'YYYY-MM-DD', the value format of <input type="date">
  motherFirstName: string;
  motherLastName: string;
  motherPhoneNumber: string;
  fatherFirstName: string;
  fatherLastName: string;
  fatherPhoneNumber: string;
  pickUpSchedule: PickUpScheduleFormModel;
}

export interface PickUpScheduleFormModel {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
}

export const emptyScholarForm = (): ScholarFormModel => ({
  firstName: '',
  lastName: '',
  schoolId: '',
  grade: null,
  dateOfBirth: '',
  motherFirstName: '',
  motherLastName: '',
  motherPhoneNumber: '',
  fatherFirstName: '',
  fatherLastName: '',
  fatherPhoneNumber: '',
  pickUpSchedule: { monday: '', tuesday: '', wednesday: '', thursday: '', friday: '' },
});

// Matches the backend's ValidatePhoneNumber — loose on purpose (no
// country-specific format assumed), just enough to catch obviously wrong
// input (e.g. text typed into the field) before a round-trip to the API.
// pattern() skips empty values, so the phone fields stay optional.
export const PHONE_PATTERN = /^\+?[0-9 ()-]{6,20}$/;

const NAME_MAX_LENGTH = 100;

export const scholarFormSchema = schema<ScholarFormModel>((p) => {
  required(p.firstName, { message: 'First Name is required.' });
  maxLength(p.firstName, NAME_MAX_LENGTH, {
    message: `First Name can't exceed ${NAME_MAX_LENGTH} characters.`,
  });
  required(p.lastName, { message: 'Last Name is required.' });
  maxLength(p.lastName, NAME_MAX_LENGTH, {
    message: `Last Name can't exceed ${NAME_MAX_LENGTH} characters.`,
  });

  required(p.schoolId, { message: 'School is required.' });

  required(p.grade, { message: 'Grade is required.' });
  min(p.grade, 0, { message: 'Grade must be between 0 and 12.' });
  max(p.grade, 12, { message: 'Grade must be between 0 and 12.' });

  required(p.dateOfBirth, { message: 'Birth Date is required.' });
  validate(p.dateOfBirth, ({ value }) => {
    if (!value()) return undefined; // the required() rule above reports blanks
    const date = new Date(value());
    return isNaN(date.getTime()) || date > new Date()
      ? { kind: 'invalidDate', message: 'Please enter a valid date (not in the future).' }
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
    pattern(phoneNumber, PHONE_PATTERN, { message: 'Not a valid phone number.' });
  }
});

export function toFormModel(scholar: Scholar): ScholarFormModel {
  return {
    firstName: scholar.firstName,
    lastName: scholar.lastName,
    schoolId: scholar.schoolId?.toString() ?? '',
    grade: scholar.grade,
    dateOfBirth: scholar.dateOfBirth
      ? new Date(scholar.dateOfBirth).toISOString().substring(0, 10)
      : '',
    motherFirstName: scholar.motherFirstName ?? '',
    motherLastName: scholar.motherLastName ?? '',
    motherPhoneNumber: scholar.motherPhoneNumber ?? '',
    fatherFirstName: scholar.fatherFirstName ?? '',
    fatherLastName: scholar.fatherLastName ?? '',
    fatherPhoneNumber: scholar.fatherPhoneNumber ?? '',
    pickUpSchedule: {
      monday: scholar.pickUpSchedule?.monday ?? '',
      tuesday: scholar.pickUpSchedule?.tuesday ?? '',
      wednesday: scholar.pickUpSchedule?.wednesday ?? '',
      thursday: scholar.pickUpSchedule?.thursday ?? '',
      friday: scholar.pickUpSchedule?.friday ?? '',
    },
  };
}

// `id` is the existing scholar's id when editing; for a new one the server
// assigns the real id and this all-zero guid is just a placeholder.
export function toScholar(model: ScholarFormModel, id: string | null): Scholar {
  return {
    id: id ?? '00000000-0000-0000-0000-000000000000',
    firstName: model.firstName,
    lastName: model.lastName,
    schoolId: Number(model.schoolId),
    grade: model.grade,
    dateOfBirth: new Date(model.dateOfBirth),
    motherFirstName: model.motherFirstName || null,
    motherLastName: model.motherLastName || null,
    motherPhoneNumber: model.motherPhoneNumber || null,
    fatherFirstName: model.fatherFirstName || null,
    fatherLastName: model.fatherLastName || null,
    fatherPhoneNumber: model.fatherPhoneNumber || null,
    pickUpSchedule: { ...model.pickUpSchedule },
  };
}
