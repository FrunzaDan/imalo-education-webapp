using ImaloEducationApi.Models;

namespace ImaloEducationApi.Data;

// Extracted purely so ScholarsController can be unit-tested against a mock —
// see ImaloEducationApi.Tests/Controllers/ScholarsControllerTests.cs. No second
// implementation exists or is planned; ScholarDataAccess remains the only one.
public interface IScholarDataAccess
{
    Task<Scholar> CreateScholarAsync(Scholar scholar, CancellationToken cancellationToken);
    Task<IReadOnlyList<Scholar>> GetScholarsAsync(CancellationToken cancellationToken);
    Task<Scholar?> GetScholarAsync(Guid scholarId, CancellationToken cancellationToken);
    Task<Scholar?> UpdateScholarAsync(Scholar scholar, CancellationToken cancellationToken);
    Task<bool> DeleteScholarAsync(Guid scholarId, CancellationToken cancellationToken);

    Task<bool> SaveAttendanceAsync(Guid scholarId, List<AttendanceRecord> attendance,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<AttendanceRecord>> GetAttendanceAsync(Guid scholarId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ScholarAttendance>> GetAllAttendanceAsync(CancellationToken cancellationToken);
    Task<bool> DeleteAttendanceAsync(Guid scholarId, CancellationToken cancellationToken);

    Task<IReadOnlyList<AuditLogEntry>> GetScholarAuditLogAsync(Guid scholarId, CancellationToken cancellationToken);
    Task<PagedResponse<GlobalAuditLogEntry>> GetAllScholarAuditLogAsync(int pageNumber, int pageSize,
        CancellationToken cancellationToken);
    Task DeleteAllScholarAuditLogAsync(CancellationToken cancellationToken);
}
