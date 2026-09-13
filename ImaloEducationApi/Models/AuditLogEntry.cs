namespace ImaloEducationApi.Models;

public class AuditLogEntry
{
    public int AuditId { get; set; }

    public Guid ScholarId { get; set; }

    public string Action { get; set; } = string.Empty;

    public string? Details { get; set; }

    public DateTime ActionDate { get; set; }
}

public class GlobalAuditLogEntry
{
    public int AuditId { get; set; }

    public Guid ScholarId { get; set; }

    // Null when the scholar no longer exists (GetAllAuditLogAsync LEFT JOINs
    // Scholars, since audit history outlives a deleted scholar).
    public string? FirstName { get; set; }

    public string? LastName { get; set; }

    public string Action { get; set; } = string.Empty;

    public string? Details { get; set; }

    public DateTime ActionDate { get; set; }
}
