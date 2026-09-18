export interface GlobalAuditLogEntry {
  auditId: number;
  scholarId: string;
  // Null when the scholar no longer exists (the API LEFT JOINs Scholars,
  // since audit history outlives a deleted scholar).
  firstName: string | null;
  lastName: string | null;
  action: string;
  details: string | null;
  actionDate: string;
}
