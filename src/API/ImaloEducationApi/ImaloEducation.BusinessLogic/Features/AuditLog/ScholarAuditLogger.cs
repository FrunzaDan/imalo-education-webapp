using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.Domain.Models;
using Microsoft.Extensions.Logging;

namespace ImaloEducation.BusinessLogic.Features.AuditLog;

public sealed partial class ScholarAuditLogger(IScholarRepository repository, ILogger<ScholarAuditLogger> logger)
    : IScholarAuditLogger
{
    public async Task LogAsync(Guid scholarId, AuditAction action, string? details = null)
    {
        try
        {
            await repository.AddAuditEntryAsync(scholarId, action, details, CancellationToken.None);
        }
        catch (Exception ex)
        {
            LogAuditWriteFailed(logger, ex, scholarId, action);
        }
    }

    [LoggerMessage(EventId = 2, Level = LogLevel.Error,
        Message = "Failed to write audit log entry for scholar {ScholarId}, action {Action}")]
    private static partial void LogAuditWriteFailed(ILogger logger, Exception exception, Guid scholarId,
        AuditAction action);
}
