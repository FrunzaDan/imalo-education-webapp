import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SortingService {
  sort<T>(
    data: T[],
    column: keyof T,
    type: 'string' | 'number' | 'date',
    isAscending: boolean,
  ): T[] {
    const sortedData = [...data];

    const compareFn = this.getComparator(type);

    sortedData.sort((a, b) => {
      const valA = a[column];
      const valB = b[column];

      if (valA == null && valB == null) return 0;
      if (valA == null) return isAscending ? -1 : 1;
      if (valB == null) return isAscending ? 1 : -1;

      const comparison = compareFn(valA, valB);
      return isAscending ? comparison : -comparison;
    });

    return sortedData;
  }

  private getComparator(
    type: 'string' | 'number' | 'date',
  ): (a: any, b: any) => number {
    const comparators: Record<string, (a: any, b: any) => number> = {
      string: this.compareStrings.bind(this),
      number: this.compareNumbers.bind(this),
      date: this.compareDates.bind(this),
    };

    return comparators[type] || this.compareStrings.bind(this);
  }

  private compareStrings(a: any, b: any): number {
    return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
  }

  private compareNumbers(a: any, b: any): number {
    return Number(a) - Number(b);
  }

  private compareDates(a: any, b: any): number {
    const timeA = this.parseDate(a);
    const timeB = this.parseDate(b);
    return timeA - timeB;
  }

  private parseDate(value: any): number {
    const date = new Date(value);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }
}
