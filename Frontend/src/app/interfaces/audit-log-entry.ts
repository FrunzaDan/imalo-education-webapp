export interface AuditLogEntry {
  auditId: number;
  scholarId: string;
  action: string;
  details: string | null;
  actionDate: string;
}
