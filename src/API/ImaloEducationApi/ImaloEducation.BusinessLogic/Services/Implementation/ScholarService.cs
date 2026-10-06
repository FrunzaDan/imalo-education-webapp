using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.BusinessLogic.ScholarFunctions;
using ImaloEducation.Domain.Models;
using Microsoft.Extensions.Logging;

namespace ImaloEducation.BusinessLogic.Services.Implementation;

public sealed partial class ScholarService : IScholarService
{
    private readonly IScholarRepository _repository;
    private readonly ILogger<ScholarService> _logger;

    public ScholarService(IScholarRepository repository, ILogger<ScholarService> logger)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<Scholar> CreateScholarAsync(Scholar scholar, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(scholar);

        var created = await _repository.CreateScholarAsync(scholar, cancellationToken);
        await LogAuditAsync(created.ScholarId, AuditAction.Created);
        return created;
    }

    public Task<IReadOnlyList<Scholar>> GetScholarsAsync(CancellationToken cancellationToken) =>
        _repository.GetScholarsAsync(cancellationToken);

    public Task<Scholar?> GetScholarAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        EnsureScholarId(scholarId);
        return _repository.GetScholarAsync(scholarId, cancellationToken);
    }

    public async Task<Scholar?> UpdateScholarAsync(Scholar scholar, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(scholar);
        if (scholar.ScholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholar));

        var before = await _repository.UpdateScholarAsync(scholar, cancellationToken);
        if (before is null) return null;

        await LogAuditAsync(scholar.ScholarId, AuditAction.Edited, ScholarChanges.Describe(before, scholar));
        return scholar;
    }

    public async Task<bool> DeleteScholarAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        EnsureScholarId(scholarId);

        if (!await _repository.DeleteScholarAsync(scholarId, cancellationToken)) return false;

        await LogAuditAsync(scholarId, AuditAction.Deleted);
        return true;
    }

    public Task<bool> SaveAttendanceAsync(Guid scholarId, List<AttendanceRecord> attendance,
        CancellationToken cancellationToken)
    {
        EnsureScholarId(scholarId);
        ArgumentNullException.ThrowIfNull(attendance);
        return _repository.SaveAttendanceAsync(scholarId, attendance, cancellationToken);
    }

    public Task<IReadOnlyList<AttendanceRecord>> GetAttendanceAsync(Guid scholarId,
        CancellationToken cancellationToken)
    {
        EnsureScholarId(scholarId);
        return _repository.GetAttendanceAsync(scholarId, cancellationToken);
    }

    public Task<IReadOnlyList<ScholarAttendance>> GetAllAttendanceAsync(CancellationToken cancellationToken) =>
        _repository.GetAllAttendanceAsync(cancellationToken);

    public Task<bool> DeleteAttendanceAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        EnsureScholarId(scholarId);
        return _repository.DeleteAttendanceAsync(scholarId, cancellationToken);
    }

    public Task<IReadOnlyList<AuditLogEntry>> GetScholarAuditLogAsync(Guid scholarId,
        CancellationToken cancellationToken)
    {
        EnsureScholarId(scholarId);
        return _repository.GetScholarAuditLogAsync(scholarId, cancellationToken);
    }

    public Task<PagedResponse<GlobalAuditLogEntry>> GetAllScholarAuditLogAsync(int pageNumber, int pageSize,
        CancellationToken cancellationToken) =>
        _repository.GetAllScholarAuditLogAsync(pageNumber, pageSize, cancellationToken);

    public Task DeleteAllScholarAuditLogAsync(CancellationToken cancellationToken) =>
        _repository.DeleteAllScholarAuditLogAsync(cancellationToken);

    private static void EnsureScholarId(Guid scholarId)
    {
        if (scholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholarId));
    }

    // The change is already committed, so a failed audit write is logged, not thrown, and is not
    // cancelled with the request.
    private async Task LogAuditAsync(Guid scholarId, AuditAction action, string? details = null)
    {
        try
        {
            await _repository.AddAuditEntryAsync(scholarId, action, details, CancellationToken.None);
        }
        catch (Exception ex)
        {
            LogAuditWriteFailed(_logger, ex, scholarId, action);
        }
    }

    [LoggerMessage(EventId = 2, Level = LogLevel.Error,
        Message = "Failed to write audit log entry for scholar {ScholarId}, action {Action}")]
    private static partial void LogAuditWriteFailed(ILogger logger, Exception exception, Guid scholarId,
        AuditAction action);
}
