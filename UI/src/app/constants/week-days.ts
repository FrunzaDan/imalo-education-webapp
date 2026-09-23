// The school days a pickup schedule covers, in display order. A readonly tuple
// rather than a TS enum: it emits no runtime enum object, and `WeekDay` is
// derived from it, so the list and the type can't drift apart.
export const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;

export type WeekDay = (typeof WEEK_DAYS)[number];
