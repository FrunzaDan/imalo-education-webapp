using System.ComponentModel.DataAnnotations;
using ImaloEducation.BusinessLogic.Contracts;
using ImaloEducation.BusinessLogic.Features.Attendance;
using ImaloEducation.BusinessLogic.Features.AuditLog;
using ImaloEducation.BusinessLogic.Features.Scholars;
using ImaloEducation.BusinessLogic.Validations;
using ImaloEducation.Domain.Models;
using Microsoft.AspNetCore.Mvc;

namespace ImaloEducation.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScholarsController : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<Scholar>> CreateScholar([FromBody] ScholarRequest scholar,
        [FromServices] CreateScholarHandler handler, CancellationToken cancellationToken)
    {
        var createdScholar = await handler.HandleAsync(scholar, cancellationToken);
        return CreatedAtAction(nameof(GetScholar), new { scholarId = createdScholar.ScholarId }, createdScholar);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Scholar>>> GetScholars([FromServices] GetScholarsHandler handler,
        CancellationToken cancellationToken) =>
        Ok(await handler.HandleAsync(cancellationToken));

    [HttpGet("{scholarId:guid}")]
    public async Task<ActionResult<Scholar>> GetScholar(Guid scholarId, [FromServices] GetScholarHandler handler,
        CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        var scholar = await handler.HandleAsync(scholarId, cancellationToken);
        return scholar is null ? ScholarNotFound(scholarId) : Ok(scholar);
    }

    [HttpPut("{scholarId:guid}")]
    public async Task<ActionResult<Scholar>> UpdateScholar(Guid scholarId, [FromBody] ScholarRequest scholar,
        [FromServices] UpdateScholarHandler handler, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        if (scholarId != scholar.ScholarId)
        {
            ModelState.AddModelError(nameof(ScholarRequest.ScholarId),
                "The scholar ID in the URL does not match the one in the request body.");
            return ValidationProblem();
        }

        var updatedScholar = await handler.HandleAsync(scholar, cancellationToken);
        return updatedScholar is null ? ScholarNotFound(scholarId) : Ok(updatedScholar);
    }

    [HttpDelete("{scholarId:guid}")]
    public async Task<IActionResult> DeleteScholar(Guid scholarId, [FromServices] DeleteScholarHandler handler,
        CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        var deleted = await handler.HandleAsync(scholarId, cancellationToken);
        return deleted ? NoContent() : ScholarNotFound(scholarId);
    }

    [HttpGet("{scholarId:guid}/audit-log")]
    public async Task<ActionResult<IReadOnlyList<AuditLogEntry>>> GetScholarAuditLog(Guid scholarId,
        [FromServices] GetScholarAuditLogHandler handler, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        return Ok(await handler.HandleAsync(scholarId, cancellationToken));
    }

    [HttpGet("audit-log/all")]
    public async Task<ActionResult<PagedResponse<GlobalAuditLogEntry>>> GetAllScholarAuditLog(
        [FromServices] GetAllScholarAuditLogHandler handler,
        [FromQuery, Range(1, int.MaxValue, ErrorMessage = "Page number must be 1 or greater.")]
        int pageNumber = 1,
        [FromQuery, Range(1, 100, ErrorMessage = "Page size must be between 1 and 100.")]
        int pageSize = 20,
        CancellationToken cancellationToken = default) =>
        Ok(await handler.HandleAsync(pageNumber, pageSize, cancellationToken));

    [HttpDelete("audit-log/all")]
    public async Task<IActionResult> DeleteAllScholarAuditLog([FromServices] DeleteAllScholarAuditLogHandler handler,
        CancellationToken cancellationToken)
    {
        await handler.HandleAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{scholarId:guid}/attendance")]
    public async Task<IActionResult> SaveAttendance(Guid scholarId,
        [FromBody] List<AttendanceRecordRequest> attendance, [FromServices] SaveAttendanceHandler handler,
        CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        foreach (var error in AttendanceValidation.Validate(attendance))
            ModelState.AddModelError(nameof(attendance), error);

        if (!ModelState.IsValid) return ValidationProblem();

        var saved = await handler.HandleAsync(scholarId, attendance, cancellationToken);
        return saved ? NoContent() : ScholarNotFound(scholarId);
    }

    [HttpGet("{scholarId:guid}/attendance")]
    public async Task<ActionResult<IReadOnlyList<AttendanceRecord>>> GetAttendance(Guid scholarId,
        [FromServices] GetAttendanceHandler handler, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        return Ok(await handler.HandleAsync(scholarId, cancellationToken));
    }

    [HttpDelete("{scholarId:guid}/attendance")]
    public async Task<IActionResult> DeleteAttendance(Guid scholarId, [FromServices] DeleteAttendanceHandler handler,
        CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        var deleted = await handler.HandleAsync(scholarId, cancellationToken);
        return deleted
            ? NoContent()
            : Problem(statusCode: StatusCodes.Status404NotFound,
                detail: $"No attendance record found for scholar {scholarId}.");
    }

    [HttpGet("attendance")]
    public async Task<ActionResult<IReadOnlyList<ScholarAttendance>>> GetAllAttendance(
        [FromServices] GetAllAttendanceHandler handler, CancellationToken cancellationToken) =>
        Ok(await handler.HandleAsync(cancellationToken));

    private ActionResult EmptyScholarId()
    {
        ModelState.AddModelError("scholarId", "Scholar ID must not be empty.");
        return ValidationProblem();
    }

    private ObjectResult ScholarNotFound(Guid scholarId) =>
        Problem(statusCode: StatusCodes.Status404NotFound, detail: $"Scholar with ID {scholarId} not found.");
}
