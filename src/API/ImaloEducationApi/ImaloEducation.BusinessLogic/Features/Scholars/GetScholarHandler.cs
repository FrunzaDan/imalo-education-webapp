using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.BusinessLogic.Validations;
using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Features.Scholars;

public class GetScholarHandler(IScholarRepository repository)
{
    public Task<Scholar?> HandleAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        ScholarIdGuard.Ensure(scholarId);
        return repository.GetScholarAsync(scholarId, cancellationToken);
    }
}
