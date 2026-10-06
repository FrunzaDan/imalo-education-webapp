using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.BusinessLogic.Contracts;
using ImaloEducation.BusinessLogic.Features.AuditLog;
using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Features.Scholars;

public class CreateScholarHandler(IScholarRepository repository, IScholarAuditLogger auditLogger)
{
    public async Task<Scholar> HandleAsync(ScholarRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var created = await repository.CreateScholarAsync(request.ToScholar(), cancellationToken);
        await auditLogger.LogAsync(created.ScholarId, AuditAction.Created);
        return created;
    }
}
