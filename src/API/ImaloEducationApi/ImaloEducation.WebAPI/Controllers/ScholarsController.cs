using System.ComponentModel.DataAnnotations;
using ImaloEducation.BusinessLogic.Services;
using ImaloEducation.BusinessLogic.Validations;
using ImaloEducation.Domain.Models;
using Microsoft.AspNetCore.Mvc;

namespace ImaloEducation.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScholarsController(IScholarService scholarService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<Scholar>> CreateScholar([FromBody] Scholar scholar,
        CancellationToken cancellationToken)
    {
        var createdScholar = await scholarService.CreateScholarAsync(scholar, cancellationToken);
        return CreatedAtAction(nameof(GetScholar), new { scholarId = createdScholar.ScholarId }, createdScholar);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Scholar>>> GetScholars(CancellationToken cancellationToken) =>
        Ok(await scholarService.GetScholarsAsync(cancellationToken));

    [HttpGet("{scholarId:guid}")]
    public async Task<ActionResult<Scholar>> GetScholar(Guid scholarId, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        var scholar = await scholarService.GetScholarAsync(scholarId, cancellationToken);
        return scholar is null ? ScholarNotFound(scholarId) : Ok(scholar);
    }

    [HttpPut("{scholarId:guid}")]
    public async Task<ActionResult<Scholar>> UpdateScholar(Guid scholarId, [FromBody] Scholar scholar,
        CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        if (scholarId != scholar.ScholarId)
        {
            ModelState.AddModelError(nameof(Scholar.ScholarId),
                "The scholar ID in the URL does not match the one in the request body.");
            return ValidationProblem();
        }

        var updatedScholar = await scholarService.UpdateScholarAsync(scholar, cancellationToken);
        return updatedScholar is null ? ScholarNotFound(scholarId) : Ok(updatedScholar);
    }

    [HttpDelete("{scholarId:guid}")]
    public async Task<IActionResult> DeleteScholar(Guid scholarId, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        var deleted = await scholarService.DeleteScholarAsync(scholarId, cancellationToken);
        return deleted ? NoContent() : ScholarNotFound(scholarId);
    }

    [HttpGet("{scholarId:guid}/audit-log")]
    public async Task<ActionResult<IReadOnlyList<AuditLogEntry>>> GetScholarAuditLog(Guid scholarId,
        CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        return Ok(await scholarService.GetScholarAuditLogAsync(scholarId, cancellationToken));
    }

    [HttpGet("audit-log/all")]
    public async Task<ActionResult<PagedResponse<GlobalAuditLogEntry>>> GetAllScholarAuditLog(
        [FromQuery, Range(1, int.MaxValue, ErrorMessage = "Page number must be 1 or greater.")]
        int pageNumber = 1,
        [FromQuery, Range(1, 100, ErrorMessage = "Page size must be between 1 and 100.")]
        int pageSize = 20,
        CancellationToken cancellationToken = default) =>
        Ok(await scholarService.GetAllScholarAuditLogAsync(pageNumber, pageSize, cancellationToken));

    [HttpDelete("audit-log/all")]
    public async Task<IActionResult> DeleteAllScholarAuditLog(CancellationToken cancellationToken)
    {
        await scholarService.DeleteAllScholarAuditLogAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{scholarId:guid}/attendance")]
    public async Task<IActionResult> SaveAttendance(Guid scholarId,
        [FromBody] List<AttendanceRecord> attendance, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        foreach (var error in AttendanceValidation.Validate(attendance))
            ModelState.AddModelError(nameof(attendance), error);

        if (!ModelState.IsValid) return ValidationProblem();

        var saved = await scholarService.SaveAttendanceAsync(scholarId, attendance, cancellationToken);
        return saved ? NoContent() : ScholarNotFound(scholarId);
    }

    [HttpGet("{scholarId:guid}/attendance")]
    public async Task<ActionResult<IReadOnlyList<AttendanceRecord>>> GetAttendance(Guid scholarId,
        CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        return Ok(await scholarService.GetAttendanceAsync(scholarId, cancellationToken));
    }

    [HttpDelete("{scholarId:guid}/attendance")]
    public async Task<IActionResult> DeleteAttendance(Guid scholarId, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        var deleted = await scholarService.DeleteAttendanceAsync(scholarId, cancellationToken);
        return deleted
            ? NoContent()
            : Problem(statusCode: StatusCodes.Status404NotFound,
                detail: $"No attendance record found for scholar {scholarId}.");
    }

    [HttpGet("attendance")]
    public async Task<ActionResult<IReadOnlyList<ScholarAttendance>>> GetAllAttendance(CancellationToken cancellationToken) =>
        Ok(await scholarService.GetAllAttendanceAsync(cancellationToken));

    private ActionResult EmptyScholarId()
    {
        ModelState.AddModelError("scholarId", "Scholar ID must not be empty.");
        return ValidationProblem();
    }

    private ObjectResult ScholarNotFound(Guid scholarId) =>
        Problem(statusCode: StatusCodes.Status404NotFound, detail: $"Scholar with ID {scholarId} not found.");
}
