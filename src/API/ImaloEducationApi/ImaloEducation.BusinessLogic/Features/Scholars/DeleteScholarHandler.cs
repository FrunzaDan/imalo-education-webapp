using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.BusinessLogic.Features.AuditLog;
using ImaloEducation.BusinessLogic.Validations;
using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Features.Scholars;

public class DeleteScholarHandler(IScholarRepository repository, IScholarAuditLogger auditLogger)
{
    public async Task<bool> HandleAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        ScholarIdGuard.Ensure(scholarId);

        if (!await repository.DeleteScholarAsync(scholarId, cancellationToken)) return false;

        await auditLogger.LogAsync(scholarId, AuditAction.Deleted);
        return true;
    }
}
