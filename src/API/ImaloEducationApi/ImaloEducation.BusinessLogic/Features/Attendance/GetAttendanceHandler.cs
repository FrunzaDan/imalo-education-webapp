using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.BusinessLogic.Validations;
using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Features.Attendance;

public class GetAttendanceHandler(IScholarRepository repository)
{
    public Task<IReadOnlyList<AttendanceRecord>> HandleAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        ScholarIdGuard.Ensure(scholarId);
        return repository.GetAttendanceAsync(scholarId, cancellationToken);
    }
}
