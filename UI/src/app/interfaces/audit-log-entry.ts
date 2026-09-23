import { IsoDateTime } from './iso-date';

// ScholarAuditLog.ActionType — serialized by the API by name.
export type AuditAction = 'Created' | 'Edited' | 'Deleted';

export interface AuditLogEntry {
  scholarAuditLogId: number;
  scholarId: string;
  actionType: AuditAction;
  details: string | null;
  occurredAt: IsoDateTime;
}
