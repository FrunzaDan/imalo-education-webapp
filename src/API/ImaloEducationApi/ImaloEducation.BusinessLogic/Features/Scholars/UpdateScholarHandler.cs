using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.BusinessLogic.Contracts;
using ImaloEducation.BusinessLogic.Features.AuditLog;
using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Features.Scholars;

public class UpdateScholarHandler(IScholarRepository repository, IScholarAuditLogger auditLogger)
{
    // Returns the scholar as saved, or null when no scholar has that ID.
    public async Task<Scholar?> HandleAsync(ScholarRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.ScholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(request));

        var scholar = request.ToScholar();
        var before = await repository.UpdateScholarAsync(scholar, cancellationToken);
        if (before is null) return null;

        await auditLogger.LogAsync(scholar.ScholarId, AuditAction.Edited, ScholarChanges.Describe(before, scholar));
        return scholar;
    }
}
