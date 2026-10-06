using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Features.Scholars;

public class GetScholarsHandler(IScholarRepository repository)
{
    public Task<IReadOnlyList<Scholar>> HandleAsync(CancellationToken cancellationToken) =>
        repository.GetScholarsAsync(cancellationToken);
}
