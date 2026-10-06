using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Features.Attendance;

public class GetAllAttendanceHandler(IScholarRepository repository)
{
    public Task<IReadOnlyList<ScholarAttendance>> HandleAsync(CancellationToken cancellationToken) =>
        repository.GetAllAttendanceAsync(cancellationToken);
}
