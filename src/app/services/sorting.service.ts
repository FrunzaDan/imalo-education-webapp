import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SortingService {
  /**
   * Sorts an array based on a specified column and type.
   * @param data Array to be sorted
   * @param column Column name to sort by
   * @param type Data type of the column ('string', 'number', 'date')
   * @param isAscending Whether to sort in ascending order
   */
  sort<T>(
    data: T[],
    column: keyof T,
    type: 'string' | 'number' | 'date',
    isAscending: boolean
  ): T[] {
    return data.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];

      if (type === 'date') {
        valA = new Date(
          valA as unknown as string
        ).getTime() as unknown as T[keyof T];
        valB = new Date(
          valB as unknown as string
        ).getTime() as unknown as T[keyof T];
      }

      if (valA < valB) return isAscending ? -1 : 1;
      if (valA > valB) return isAscending ? 1 : -1;
      return 0;
    });
  }
}
