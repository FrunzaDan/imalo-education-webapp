using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.BusinessLogic.Validations;

namespace ImaloEducation.BusinessLogic.Features.Attendance;

public class DeleteAttendanceHandler(IScholarRepository repository)
{
    public Task<bool> HandleAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        ScholarIdGuard.Ensure(scholarId);
        return repository.DeleteAttendanceAsync(scholarId, cancellationToken);
    }
}
