import { Injectable } from '@angular/core';

export type SortType = 'string' | 'number' | 'date';
export type SortDirection = 'asc' | 'desc';

type Comparator = (a: unknown, b: unknown) => number;

const COMPARATORS: Record<SortType, Comparator> = {
  string: (a, b) =>
    String(a).toLowerCase().localeCompare(String(b).toLowerCase()),
  number: (a, b) => Number(a) - Number(b),
  date: (a, b) => toTime(a) - toTime(b),
};

function toTime(value: unknown): number {
  const time = new Date(value as string | number | Date).getTime();
  return isNaN(time) ? 0 : time;
}

@Injectable({
  providedIn: 'root',
})
export class SortingService {
  // Returns a sorted copy. Null and undefined values sort first when ascending
  // and last when descending.
  sort<T>(
    data: readonly T[],
    column: keyof T,
    type: SortType,
    direction: SortDirection,
  ): T[] {
    const compare = COMPARATORS[type];
    const sign = direction === 'asc' ? 1 : -1;

    return [...data].sort((a, b) => {
      const valueA = a[column];
      const valueB = b[column];

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return -sign;
      if (valueB == null) return sign;

      return compare(valueA, valueB) * sign;
    });
  }
}
