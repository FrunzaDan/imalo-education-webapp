import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SortingService {
  /**
   * Sorts a copy of the array based on a specified column and type.
   * @param data Array to be sorted
   * @param column Column name to sort by
   * @param type Data type of the column ('string', 'number', 'date')
   * @param isAscending Whether to sort in ascending order
   * @returns New sorted array (original array is not mutated)
   */
  sort<T>(
    data: T[],
    column: keyof T,
    type: 'string' | 'number' | 'date',
    isAscending: boolean,
  ): T[] {
    const sortedData = [...data]; // clone to avoid mutating original

    sortedData.sort((a, b) => {
      const valA = a[column];
      const valB = b[column];

      // Handle null or undefined values
      if (valA == null && valB == null) return 0;
      if (valA == null) return isAscending ? -1 : 1;
      if (valB == null) return isAscending ? 1 : -1;

      let comparison = 0;

      switch (type) {
        case 'number': {
          const numA = Number(valA);
          const numB = Number(valB);
          comparison = numA - numB;
          break;
        }
        case 'date': {
          const dateA = new Date(valA as unknown as string);
          const dateB = new Date(valB as unknown as string);

          // Defensive: If invalid dates, treat as 0 time
          const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
          const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();

          comparison = timeA - timeB;
          break;
        }
        case 'string':
        default: {
          const strA = String(valA).toLowerCase();
          const strB = String(valB).toLowerCase();
          comparison = strA.localeCompare(strB);
          break;
        }
      }

      return isAscending ? comparison : -comparison;
    });

    return sortedData;
  }
}
