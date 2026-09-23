namespace ImaloEducationApi.Models;

public sealed record AuditLogEntry
{
    public required int ScholarAuditLogId { get; init; }

    public required Guid ScholarId { get; init; }

    public required AuditAction ActionType { get; init; }

    public string? Details { get; init; }

    // UTC — serialized as ISO 8601 with a trailing "Z", so the browser shows it in local time.
    public required DateTime OccurredAt { get; init; }
}

public sealed record GlobalAuditLogEntry
{
    public required int ScholarAuditLogId { get; init; }

    public required Guid ScholarId { get; init; }

    // Null when the scholar no longer exists (GetAllAuditLogAsync LEFT JOINs
    // Scholar, since audit history outlives a deleted scholar).
    public string? ScholarFirstName { get; init; }

    public string? ScholarLastName { get; init; }

    public required AuditAction ActionType { get; init; }

    public string? Details { get; init; }

    // UTC.
    public required DateTime OccurredAt { get; init; }
}
