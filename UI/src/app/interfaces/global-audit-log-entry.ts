import { AuditAction } from './audit-log-entry';
import { IsoDateTime } from './iso-date';

export interface GlobalAuditLogEntry {
  scholarAuditLogId: number;
  scholarId: string;
  // Null when the scholar no longer exists (the API LEFT JOINs Scholar,
  // since audit history outlives a deleted scholar).
  scholarFirstName: string | null;
  scholarLastName: string | null;
  actionType: AuditAction;
  details: string | null;
  occurredAt: IsoDateTime;
}
