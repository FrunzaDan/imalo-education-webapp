import { AuditAction } from './audit-log-entry';
import { IsoDateTime } from './iso-date';

export interface GlobalAuditLogEntry {
  scholarAuditLogId: number;
  scholarId: string;
  scholarFirstName: string | null;
  scholarLastName: string | null;
  actionType: AuditAction;
  details: string | null;
  occurredAt: IsoDateTime;
}
