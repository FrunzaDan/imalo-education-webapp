using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.BusinessLogic.Validations;
using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Features.AuditLog;

public class GetScholarAuditLogHandler(IScholarRepository repository)
{
    public Task<IReadOnlyList<AuditLogEntry>> HandleAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        ScholarIdGuard.Ensure(scholarId);
        return repository.GetScholarAuditLogAsync(scholarId, cancellationToken);
    }
}
