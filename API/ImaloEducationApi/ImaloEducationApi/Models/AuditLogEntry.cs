namespace ImaloEducationApi.Models;

public sealed record AuditLogEntry
{
    public required int ScholarAuditLogId { get; init; }

    public required Guid ScholarId { get; init; }

    public required AuditAction ActionType { get; init; }

    public string? Details { get; init; }

    public required DateTime OccurredAt { get; init; }
}

public sealed record GlobalAuditLogEntry
{
    public required int ScholarAuditLogId { get; init; }

    public required Guid ScholarId { get; init; }

    public string? ScholarFirstName { get; init; }

    public string? ScholarLastName { get; init; }

    public required AuditAction ActionType { get; init; }

    public string? Details { get; init; }

    public required DateTime OccurredAt { get; init; }
}
