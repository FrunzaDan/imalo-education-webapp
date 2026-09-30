import { Gender } from '../interfaces/scholar';

const GENDER_LABELS: Record<Gender, string> = {
  [Gender.Male]: 'Boy',
  [Gender.Female]: 'Girl',
  [Gender.NotDeclared]: 'Not declared',
};

export function genderLabel(gender: Gender): string {
  return GENDER_LABELS[gender] ?? GENDER_LABELS[Gender.NotDeclared];
}
