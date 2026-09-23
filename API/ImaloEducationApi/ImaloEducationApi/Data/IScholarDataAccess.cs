using ImaloEducationApi.Models;

namespace ImaloEducationApi.Data;

// Extracted purely so ScholarsController can be unit-tested against a mock —
// see ImaloEducationApi.Tests/Controllers/ScholarsControllerTests.cs. No second
// implementation exists or is planned; ScholarDataAccess remains the only one.
public interface IScholarDataAccess
{
    Task<Scholar> CreateScholarAsync(Scholar scholar, CancellationToken cancellationToken);
    Task<IEnumerable<Scholar>> GetScholarsAsync(CancellationToken cancellationToken);
    Task<Scholar?> GetScholarByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<Scholar?> UpdateScholarAsync(Scholar scholar, CancellationToken cancellationToken);
    Task<bool> DeleteScholarAsync(Guid id, CancellationToken cancellationToken);

    Task<bool> CreateOrUpdateAttendanceAsync(Guid scholarId, List<AttendanceRecord> attendanceRecords,
        CancellationToken cancellationToken);
    Task<List<AttendanceRecord>> GetAttendanceByScholarIdAsync(Guid scholarId, CancellationToken cancellationToken);
    Task<List<ScholarAttendance>> GetAllAttendanceAsync(CancellationToken cancellationToken);
    Task<bool> DeleteAttendanceAsync(Guid scholarId, CancellationToken cancellationToken);

    Task<List<AuditLogEntry>> GetAuditLogByScholarIdAsync(Guid scholarId, CancellationToken cancellationToken);
    Task<PagedResult<GlobalAuditLogEntry>> GetAllAuditLogAsync(int pageNumber, int pageSize,
        CancellationToken cancellationToken);
    Task DeleteAllAuditLogAsync(CancellationToken cancellationToken);
}
