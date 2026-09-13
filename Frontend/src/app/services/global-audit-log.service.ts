import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { GlobalAuditLogEntry } from '../interfaces/global-audit-log-entry';
import { PagedResponse } from '../interfaces/paged-response';

export interface LoadAllAuditLogParams {
  pageNumber: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class GlobalAuditLogService {
  private readonly API_URL = `${environment.baseUrlScholars}/auditLog/all`;

  private readonly state = signal({
    entries: [] as GlobalAuditLogEntry[],
    loading: false,
    error: null as string | null,
    pageNumber: 1,
    pageSize: 20,
    totalItems: 0,
  });

  readonly entries = computed(() => this.state().entries);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly pageNumber = computed(() => this.state().pageNumber);
  readonly totalItems = computed(() => this.state().totalItems);

  constructor(private http: HttpClient) {}

  loadAllAuditLog(params: LoadAllAuditLogParams): void {
    this.state.update((state) => ({ ...state, loading: true, error: null }));

    const httpParams = new HttpParams()
      .set('pageNumber', params.pageNumber)
      .set('pageSize', params.pageSize);

    this.http
      .get<PagedResponse<GlobalAuditLogEntry>>(this.API_URL, { params: httpParams })
      .subscribe({
        next: (paged) =>
          this.state.update((state) => ({
            ...state,
            entries: paged.items,
            pageNumber: paged.pageNumber,
            pageSize: paged.pageSize,
            totalItems: paged.totalItems,
            loading: false,
          })),
        error: (error: HttpErrorResponse) =>
          this.state.update((state) => ({
            ...state,
            loading: false,
            error: this.extractErrorMessage(error),
          })),
      });
  }

  clearAuditLog(): Observable<void> {
    return this.http.delete<void>(this.API_URL);
  }

  private extractErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Could not reach the server. It may be offline.';
    }
    return error.error?.message ?? `Request failed (${error.status}). Please try again.`;
  }
}
