using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.BusinessLogic.Contracts;
using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Features.AuditLog;

public class GetAllScholarAuditLogHandler(IScholarRepository repository)
{
    public Task<PagedResponse<GlobalAuditLogEntry>> HandleAsync(int pageNumber, int pageSize,
        CancellationToken cancellationToken) =>
        repository.GetAllScholarAuditLogAsync(pageNumber, pageSize, cancellationToken);
}
