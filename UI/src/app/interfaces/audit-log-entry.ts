import { AuditAction } from './audit-action';

export interface AuditLogEntry {
  auditId: number;
  scholarId: string;
  action: AuditAction;
  details: string | null;
  actionDate: string; // ISO 8601 with UTC offset, e.g. '2026-09-23T10:00:00+00:00'
}
