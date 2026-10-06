using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Abstractions;

/// <summary>Scholar persistence. BusinessLogic declares it; DataAccess implements it.</summary>
public interface IScholarRepository
{
    /// <summary>Inserts the scholar, its pickup schedule and parents in one transaction and sets its new ID.</summary>
    Task<Scholar> CreateScholarAsync(Scholar scholar, CancellationToken cancellationToken);
    Task<IReadOnlyList<Scholar>> GetScholarsAsync(CancellationToken cancellationToken);
    Task<Scholar?> GetScholarAsync(Guid scholarId, CancellationToken cancellationToken);

    /// <summary>
    /// Updates the scholar in one transaction. Returns the scholar as it was before the update, read under
    /// the same lock, or null when no scholar has that ID.
    /// </summary>
    Task<Scholar?> UpdateScholarAsync(Scholar scholar, CancellationToken cancellationToken);
    Task<bool> DeleteScholarAsync(Guid scholarId, CancellationToken cancellationToken);

    Task<bool> SaveAttendanceAsync(Guid scholarId, List<AttendanceRecord> attendance,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<AttendanceRecord>> GetAttendanceAsync(Guid scholarId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ScholarAttendance>> GetAllAttendanceAsync(CancellationToken cancellationToken);
    Task<bool> DeleteAttendanceAsync(Guid scholarId, CancellationToken cancellationToken);

    Task AddAuditEntryAsync(Guid scholarId, AuditAction action, string? details,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<AuditLogEntry>> GetScholarAuditLogAsync(Guid scholarId, CancellationToken cancellationToken);
    Task<PagedResponse<GlobalAuditLogEntry>> GetAllScholarAuditLogAsync(int pageNumber, int pageSize,
        CancellationToken cancellationToken);
    Task DeleteAllScholarAuditLogAsync(CancellationToken cancellationToken);
}
