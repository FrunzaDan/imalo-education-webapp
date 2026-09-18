import { Injectable } from '@angular/core';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

// Client-side CSV generation: unlike Customer_Management_System's
// ExportCustomerService (which streams a CSV from the API because its list
// is server-paginated/searched), every table in this app already holds its
// full, already-loaded dataset in memory — so there's nothing to gain from a
// round-trip, and no export endpoint needs to exist on the API.
@Injectable({ providedIn: 'root' })
export class CsvExportService {
  export<T>(filenamePrefix: string, columns: CsvColumn<T>[], rows: T[]): void {
    const header = columns.map((c) => this.escape(c.header)).join(',');
    const lines = rows.map((row) =>
      columns.map((c) => this.escape(c.value(row))).join(','),
    );
    const csv = [header, ...lines].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    this.triggerDownload(blob, this.buildFilename(filenamePrefix));
  }

  private escape(value: string | number | null | undefined): string {
    const str = value == null ? '' : String(value);
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  private buildFilename(prefix: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}_${timestamp}.csv`;
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
