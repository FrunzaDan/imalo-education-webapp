import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, Subject, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { GlobalAuditLogEntry } from '../interfaces/global-audit-log-entry';
import { PagedResponse } from '../interfaces/paged-response';
import { extractErrorMessage } from '../utils/extract-error-message';
import { NotificationService } from './notification.service';

export interface LoadAllAuditLogParams {
  pageNumber: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class GlobalAuditLogService {
  private readonly API_URL = `${environment.apiUrl}/api/scholars/audit-log/all`;

  private readonly state = signal({
    entries: [] as GlobalAuditLogEntry[],
    loading: false,
    error: null as string | null,
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
  });

  readonly entries = computed(() => this.state().entries);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly pageNumber = computed(() => this.state().pageNumber);
  readonly totalItems = computed(() => this.state().totalItems);

  // Routed through switchMap so a new loadAllAuditLog() call cancels whatever request is
  // still in flight — without this, a slower earlier response can land after a faster
  // later one and overwrite it with stale data.
  private readonly loadParams$ = new Subject<LoadAllAuditLogParams>();

  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);

  constructor() {
    this.loadParams$
      .pipe(
        switchMap((params) => {
          const httpParams = new HttpParams()
            .set('pageNumber', params.pageNumber)
            .set('pageSize', params.pageSize);

          return this.http
            .get<PagedResponse<GlobalAuditLogEntry>>(this.API_URL, {
              params: httpParams,
            })
            .pipe(
              map((paged) => ({ paged, requestedParams: params })),
              catchError((error: HttpErrorResponse) => {
                this.handleError(error);
                return of(null);
              }),
            );
        }),
      )
      .subscribe((result) => {
        if (!result) return;

        const { paged, requestedParams } = result;
        this.state.update((state) => ({
          ...state,
          entries: paged?.items ?? [],
          pageNumber: paged?.pageNumber ?? requestedParams.pageNumber,
          pageSize: paged?.pageSize ?? requestedParams.pageSize,
          totalItems: paged?.totalItems ?? 0,
          loading: false,
          error: null,
        }));
      });
  }

  loadAllAuditLog(params: LoadAllAuditLogParams): void {
    this.state.update((state) => ({ ...state, loading: true, error: null }));
    this.loadParams$.next(params);
  }

  deleteAllAuditLog(): Observable<void> {
    return this.http.delete<void>(this.API_URL).pipe(
      tap(() => {
        this.state.update((state) => ({
          ...state,
          entries: [],
          pageNumber: 1,
          totalItems: 0,
        }));
        this.notificationService.show('Audit log cleared successfully.');
      }),
    );
  }

  private handleError(error: HttpErrorResponse): void {
    this.state.update((state) => ({
      ...state,
      loading: false,
      error: extractErrorMessage(error, 'Failed to load the audit log'),
    }));
  }
}
