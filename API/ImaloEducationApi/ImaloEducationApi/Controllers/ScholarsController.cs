using System.ComponentModel.DataAnnotations;
using ImaloEducationApi.Data;
using ImaloEducationApi.Models;
using Microsoft.AspNetCore.Mvc;

namespace ImaloEducationApi.Controllers;

// Error handling (see ai_docs/api.md, "Error handling"): every error response is an RFC 9457
// Problem Details body (application/problem+json).
// - Invalid input never reaches an action: [ApiController] answers 400 with a
//   ValidationProblemDetails ("errors" per field) for failed DataAnnotations, a malformed body
//   or an out-of-range query parameter.
// - Rules the attributes can't express (cross-record attendance checks, URL/body ID match) and
//   "not found" are returned here as ValidationProblem()/Problem(). "title" is left to the
//   ProblemDetailsFactory (the status's reason phrase, fixed per problem type, as RFC 9457 asks);
//   the message for this occurrence goes in "detail", which is what the UI shows.
// - Anything unexpected is not caught here: it propagates to GlobalExceptionHandler, which logs
//   it once and answers 500.
[ApiController]
[Route("api/[controller]")]
public class ScholarsController(IScholarDataAccess scholarDataAccess) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<Scholar>> CreateScholar([FromBody] Scholar scholar,
        CancellationToken cancellationToken)
    {
        var createdScholar = await scholarDataAccess.CreateScholarAsync(scholar, cancellationToken);
        return CreatedAtAction(nameof(GetScholar), new { scholarId = createdScholar.ScholarId }, createdScholar);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Scholar>>> GetScholars(CancellationToken cancellationToken) =>
        Ok(await scholarDataAccess.GetScholarsAsync(cancellationToken));

    [HttpGet("{scholarId:guid}")]
    public async Task<ActionResult<Scholar>> GetScholar(Guid scholarId, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        var scholar = await scholarDataAccess.GetScholarAsync(scholarId, cancellationToken);
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

        var updatedScholar = await scholarDataAccess.UpdateScholarAsync(scholar, cancellationToken);
        return updatedScholar is null ? ScholarNotFound(scholarId) : Ok(updatedScholar);
    }

    [HttpDelete("{scholarId:guid}")]
    public async Task<IActionResult> DeleteScholar(Guid scholarId, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        var deleted = await scholarDataAccess.DeleteScholarAsync(scholarId, cancellationToken);
        return deleted ? NoContent() : ScholarNotFound(scholarId);
    }

    // ---------------------------------------
    // Audit log endpoints
    // ---------------------------------------

    [HttpGet("{scholarId:guid}/audit-log")]
    public async Task<ActionResult<IReadOnlyList<AuditLogEntry>>> GetScholarAuditLog(Guid scholarId,
        CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        return Ok(await scholarDataAccess.GetScholarAuditLogAsync(scholarId, cancellationToken));
    }

    [HttpGet("audit-log/all")]
    public async Task<ActionResult<PagedResponse<GlobalAuditLogEntry>>> GetAllScholarAuditLog(
        [FromQuery, Range(1, int.MaxValue, ErrorMessage = "Page number must be 1 or greater.")]
        int pageNumber = 1,
        [FromQuery, Range(1, 100, ErrorMessage = "Page size must be between 1 and 100.")]
        int pageSize = 20,
        CancellationToken cancellationToken = default) =>
        Ok(await scholarDataAccess.GetAllScholarAuditLogAsync(pageNumber, pageSize, cancellationToken));

    [HttpDelete("audit-log/all")]
    public async Task<IActionResult> DeleteAllScholarAuditLog(CancellationToken cancellationToken)
    {
        await scholarDataAccess.DeleteAllScholarAuditLogAsync(cancellationToken);
        return NoContent();
    }

    // ---------------------------------------
    // Attendance endpoints for each Scholar
    // ---------------------------------------

    [HttpPost("{scholarId:guid}/attendance")]
    public async Task<IActionResult> SaveAttendance(Guid scholarId,
        [FromBody] List<AttendanceRecord> attendance, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        // One record per day: the list is stored as-is, so a repeated date would
        // leave two conflicting records for the same day.
        var duplicateDates = attendance
            .GroupBy(r => r.Date)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();
        if (duplicateDates.Count > 0)
            ModelState.AddModelError(nameof(attendance),
                $"Each date can appear only once. Repeated: {FormatDates(duplicateDates)}.");

        var absentButSelected = attendance
            .Where(r => !r.Present && (r.LunchSelected || r.TransportSelected))
            .Select(r => r.Date)
            .ToList();
        if (absentButSelected.Count > 0)
            ModelState.AddModelError(nameof(attendance),
                "Lunch or Transport cannot be selected on a day the scholar was not present: " +
                $"{FormatDates(absentButSelected)}.");

        if (!ModelState.IsValid) return ValidationProblem();

        var saved = await scholarDataAccess.SaveAttendanceAsync(scholarId, attendance, cancellationToken);
        return saved ? NoContent() : ScholarNotFound(scholarId);
    }

    [HttpGet("{scholarId:guid}/attendance")]
    public async Task<ActionResult<IReadOnlyList<AttendanceRecord>>> GetAttendance(Guid scholarId,
        CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        // No records yet is a normal state for a scholar (e.g. a brand-new one),
        // not an error — 200 with an empty list rather than 404.
        return Ok(await scholarDataAccess.GetAttendanceAsync(scholarId, cancellationToken));
    }

    [HttpDelete("{scholarId:guid}/attendance")]
    public async Task<IActionResult> DeleteAttendance(Guid scholarId, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty) return EmptyScholarId();

        var deleted = await scholarDataAccess.DeleteAttendanceAsync(scholarId, cancellationToken);
        return deleted
            ? NoContent()
            : Problem(statusCode: StatusCodes.Status404NotFound,
                detail: $"No attendance record found for scholar {scholarId}.");
    }

    [HttpGet("attendance")]
    public async Task<ActionResult<IReadOnlyList<ScholarAttendance>>> GetAllAttendance(CancellationToken cancellationToken) =>
        Ok(await scholarDataAccess.GetAllAttendanceAsync(cancellationToken));

    // The {scholarId:guid} route constraint accepts the all-zero GUID, which no row ever has.
    private ActionResult EmptyScholarId()
    {
        ModelState.AddModelError("scholarId", "Scholar ID must not be empty.");
        return ValidationProblem();
    }

    private ObjectResult ScholarNotFound(Guid scholarId) =>
        Problem(statusCode: StatusCodes.Status404NotFound, detail: $"Scholar with ID {scholarId} not found.");

    private static string FormatDates(IEnumerable<DateOnly> dates) =>
        string.Join(", ", dates.Select(date => date.ToString("yyyy-MM-dd")));
}
