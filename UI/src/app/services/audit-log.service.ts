import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuditLogEntry } from '../interfaces/audit-log-entry';
import { extractErrorMessage } from '../utils/extract-error-message';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly apiUrl = `${environment.apiUrl}/api/scholars`;

  private readonly scholarId = signal<string | undefined>(undefined);

  private readonly auditLogResource = httpResource<AuditLogEntry[]>(() => {
    const scholarId = this.scholarId();
    if (!scholarId) return undefined;
    return `${this.apiUrl}/${scholarId}/audit-log`;
  });

  readonly entries = computed(() =>
    this.auditLogResource.hasValue() ? this.auditLogResource.value() : [],
  );
  readonly loading = this.auditLogResource.isLoading;
  readonly error = computed(() => {
    const error = this.auditLogResource.error();
    return error
      ? extractErrorMessage(
          error as HttpErrorResponse,
          'Failed to load the audit trail',
        )
      : null;
  });

  loadAuditLog(scholarId: string): void {
    if (this.scholarId() === scholarId) {
      this.auditLogResource.reload();
    } else {
      this.scholarId.set(scholarId);
    }
  }
}
