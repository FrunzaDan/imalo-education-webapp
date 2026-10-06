using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.BusinessLogic.Contracts;
using ImaloEducation.BusinessLogic.Validations;

namespace ImaloEducation.BusinessLogic.Features.Attendance;

public class SaveAttendanceHandler(IScholarRepository repository)
{
    // Replaces the scholar's whole attendance sheet; false when no scholar has that ID.
    public Task<bool> HandleAsync(Guid scholarId, IReadOnlyCollection<AttendanceRecordRequest> attendance,
        CancellationToken cancellationToken)
    {
        ScholarIdGuard.Ensure(scholarId);
        ArgumentNullException.ThrowIfNull(attendance);
        return repository.SaveAttendanceAsync(scholarId,
            attendance.Select(record => record.ToAttendanceRecord()).ToList(), cancellationToken);
    }
}
