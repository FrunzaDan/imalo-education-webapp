using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Features.AuditLog;

public interface IScholarAuditLogger
{
    // The change is already committed, so a failed audit write is logged, not thrown, and is not
    // cancelled with the request.
    Task LogAsync(Guid scholarId, AuditAction action, string? details = null);
}
