using ImaloEducation.BusinessLogic.Abstractions;

namespace ImaloEducation.BusinessLogic.Features.AuditLog;

public class DeleteAllScholarAuditLogHandler(IScholarRepository repository)
{
    public Task HandleAsync(CancellationToken cancellationToken) =>
        repository.DeleteAllScholarAuditLogAsync(cancellationToken);
}
