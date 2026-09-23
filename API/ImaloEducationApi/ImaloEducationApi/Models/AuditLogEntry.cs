namespace ImaloEducationApi.Models;

public class AuditLogEntry
{
    public int AuditId { get; set; }

    public Guid ScholarId { get; set; }

    public AuditAction Action { get; set; }

    public string? Details { get; set; }

    // UTC, with its offset — serializes as "...+00:00", so the browser converts
    // it to local time instead of mistaking UTC for local.
    public DateTimeOffset ActionDate { get; set; }
}

public class GlobalAuditLogEntry : AuditLogEntry
{
    // Null when the scholar no longer exists (GetAllAuditLogAsync LEFT JOINs
    // Scholars, since audit history outlives a deleted scholar).
    public string? FirstName { get; set; }

    public string? LastName { get; set; }
}
