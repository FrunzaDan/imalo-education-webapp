import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuditLogEntry } from '../interfaces/audit-log-entry';
import { extractErrorMessage } from '../utils/extract-error-message';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly API_URL = `${environment.apiUrl}/api/scholars`;

  private readonly scholarId = signal<string | undefined>(undefined);

  // Declarative fetch: the request is a function of `scholarId`, so a new
  // scholarId cancels the in-flight request and starts another, and no request is
  // made at all until a scholarId has been set (returning undefined idles it).
  private readonly auditLog = httpResource<AuditLogEntry[]>(() => {
    const scholarId = this.scholarId();
    if (!scholarId) return undefined;
    return `${this.API_URL}/${scholarId}/audit-log`;
  });

  // hasValue() guards the read: value() throws while the resource is in error.
  readonly entries = computed(() =>
    this.auditLog.hasValue() ? this.auditLog.value() : [],
  );
  readonly loading = this.auditLog.isLoading;
  readonly error = computed(() => {
    const error = this.auditLog.error();
    return error
      ? extractErrorMessage(
          error as HttpErrorResponse,
          'Failed to load the audit trail',
        )
      : null;
  });

  loadAuditLog(scholarId: string): void {
    if (this.scholarId() === scholarId) {
      // Same scholar — the request itself hasn't changed, so ask for a fresh copy.
      this.auditLog.reload();
    } else {
      this.scholarId.set(scholarId);
    }
  }
}
