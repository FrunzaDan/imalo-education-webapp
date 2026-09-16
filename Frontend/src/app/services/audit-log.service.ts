import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuditLogEntry } from '../interfaces/audit-log-entry';
import { extractHttpErrorMessage } from '../utils/http-error';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly state = signal({
    entries: [] as AuditLogEntry[],
    loading: false,
    error: null as string | null,
  });

  readonly entries = computed(() => this.state().entries);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);

  constructor(private http: HttpClient) {}

  loadAuditLog(scholarId: string): void {
    this.state.update((state) => ({ ...state, loading: true, error: null }));

    this.http
      .get<AuditLogEntry[]>(`${environment.baseUrlScholars}/${scholarId}/auditLog`)
      .subscribe({
        next: (entries) =>
          this.state.update((state) => ({ ...state, entries, loading: false })),
        error: (error: HttpErrorResponse) =>
          this.state.update((state) => ({
            ...state,
            loading: false,
            error: extractHttpErrorMessage(error),
          })),
      });
  }
}
