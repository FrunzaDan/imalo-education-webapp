import { AuditLogEntry } from './audit-log-entry';

export interface GlobalAuditLogEntry extends AuditLogEntry {
  // Null when the scholar no longer exists (the API LEFT JOINs Scholar,
  // since audit history outlives a deleted scholar).
  firstName: string | null;
  lastName: string | null;
}
