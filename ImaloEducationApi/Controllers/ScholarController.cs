using ImaloEducationApi.Data;
using ImaloEducationApi.Models;
using Microsoft.AspNetCore.Mvc;

namespace ImaloEducationApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScholarsController : ControllerBase
{
    private readonly ILogger<ScholarsController> _logger;
    private readonly IScholarDataAccess _scholarDataAccess;

    public ScholarsController(IScholarDataAccess scholarDataAccess, ILogger<ScholarsController> logger)
    {
        _scholarDataAccess = scholarDataAccess;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<Scholar>> CreateScholar([FromBody] Scholar scholar, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState
                .Where(ms => ms.Value?.Errors.Count > 0)
                .ToDictionary(
                    kvp => kvp.Key,
                    kvp => kvp.Value!.Errors.Select(e => e.ErrorMessage).ToArray()
                );

            _logger.LogWarning("Invalid model state for CreateScholar request: {@Errors}", errors);

            return BadRequest(new
            {
                message = "Validation failed for the scholar data.",
                errors
            });
        }

        try
        {
            var createdScholar = await _scholarDataAccess.CreateScholarAsync(scholar, cancellationToken);
            _logger.LogInformation("Scholar created with ID: {ScholarId}", createdScholar.Id);
            return CreatedAtAction(nameof(GetScholarById), new { id = createdScholar.Id }, createdScholar);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogError(ex, "Error creating scholar: {Message}", ex.Message);
            return StatusCode(500, new
            {
                message = "Error creating scholar.",
                details = ex.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error creating scholar.");
            return StatusCode(500, new
            {
                message = "An unexpected error occurred.",
                details = ex.Message
            });
        }
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Scholar>>> GetScholars(CancellationToken cancellationToken)
    {
        try
        {
            var scholars = (await _scholarDataAccess.GetScholarsAsync(cancellationToken)).ToList();

            _logger.LogInformation("Retrieved {Count} scholars.", scholars.Count);
            return Ok(scholars);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error retrieving scholars.");
            return StatusCode(500, new
            {
                message = "An unexpected error occurred.",
                details = ex.Message
            });
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Scholar>> GetScholarById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var scholar = await _scholarDataAccess.GetScholarByIdAsync(id, cancellationToken);

            if (scholar is null)
            {
                _logger.LogWarning("Scholar with ID {ScholarId} not found.", id);
                return NotFound(new { message = $"Scholar with ID {id} not found." });
            }

            _logger.LogInformation("Retrieved scholar with ID: {ScholarId}", id);
            return Ok(scholar);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error retrieving scholar by ID: {ScholarId}", id);
            return StatusCode(500, new
            {
                message = "An unexpected error occurred.",
                details = ex.Message
            });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateScholar(Guid id, [FromBody] Scholar scholar, CancellationToken cancellationToken)
    {
        if (id != scholar.Id) return BadRequest(new { message = "ID in URL does not match ID in request body." });

        if (!ModelState.IsValid)
        {
            var errors = ModelState
                .Where(ms => ms.Value?.Errors.Count > 0)
                .ToDictionary(
                    kvp => kvp.Key,
                    kvp => kvp.Value!.Errors.Select(e => e.ErrorMessage).ToArray()
                );

            _logger.LogWarning("Invalid model state for UpdateScholar request: {@Errors}", errors);

            return BadRequest(new
            {
                message = "Validation failed for the scholar data.",
                errors
            });
        }

        try
        {
            var updatedScholar = await _scholarDataAccess.UpdateScholarAsync(scholar, cancellationToken);
            if (updatedScholar == null) return NotFound(new { message = $"Scholar with ID {id} not found." });

            return Ok(updatedScholar);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error updating scholar with ID: {ScholarId}", id);
            return StatusCode(500, new
            {
                message = "An unexpected error occurred while updating the scholar.",
                details = ex.Message
            });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteScholar(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await _scholarDataAccess.DeleteScholarAsync(id, cancellationToken);
            if (!deleted) return NotFound(new { message = $"Scholar with ID {id} not found." });

            return NoContent(); // 204 No Content is standard for successful DELETE
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error deleting scholar with ID: {ScholarId}", id);
            return StatusCode(500, new
            {
                message = "An unexpected error occurred while deleting the scholar.",
                details = ex.Message
            });
        }
    }

    // ---------------------------------------
    // Audit log endpoints
    // ---------------------------------------

    [HttpGet("{id:guid}/auditLog")]
    public async Task<ActionResult<IEnumerable<AuditLogEntry>>> GetScholarAuditLog(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var entries = await _scholarDataAccess.GetAuditLogByScholarIdAsync(id, cancellationToken);
            return Ok(entries);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error retrieving audit log for scholar ID: {ScholarId}", id);
            return StatusCode(500, new
            {
                message = "An unexpected error occurred while retrieving the audit log.",
                details = ex.Message
            });
        }
    }

    [HttpGet("auditLog/all")]
    public async Task<ActionResult<PagedResult<GlobalAuditLogEntry>>> GetAllAuditLog(
        [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
    {
        if (pageNumber < 1)
            return BadRequest(new { message = "Page number must be 1 or greater." });

        if (pageSize < 1 || pageSize > 100)
            return BadRequest(new { message = "Page size must be between 1 and 100." });

        try
        {
            var result = await _scholarDataAccess.GetAllAuditLogAsync(pageNumber, pageSize, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error retrieving the global audit log.");
            return StatusCode(500, new
            {
                message = "An unexpected error occurred while retrieving the audit log.",
                details = ex.Message
            });
        }
    }

    [HttpDelete("auditLog/all")]
    public async Task<IActionResult> DeleteAllAuditLog(CancellationToken cancellationToken)
    {
        try
        {
            await _scholarDataAccess.DeleteAllAuditLogAsync(cancellationToken);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error clearing the audit log.");
            return StatusCode(500, new
            {
                message = "An unexpected error occurred while clearing the audit log.",
                details = ex.Message
            });
        }
    }

    // ---------------------------------------
    // Attendance endpoints for each Scholar
    // ---------------------------------------

    [HttpPost("{id:guid}/attendance")]
    public async Task<IActionResult> CreateOrUpdateAttendance(Guid id, [FromBody] List<AttendanceRecord> attendance, CancellationToken cancellationToken)
    {
        if (id == Guid.Empty)
            return BadRequest(new { message = "Invalid scholar ID." });

        if (attendance == null)
            return BadRequest(new { message = "Attendance data is required." });

        try
        {
            var result = await _scholarDataAccess.CreateOrUpdateAttendanceAsync(id, attendance, cancellationToken);
            if (result)
            {
                _logger.LogInformation("Attendance created/updated for scholar {ScholarId}", id);
                return Ok(new { message = "Attendance record saved successfully." });
            }

            return StatusCode(500, new { message = "Failed to save attendance record." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error saving attendance for scholar ID: {ScholarId}", id);
            return StatusCode(500, new
            {
                message = "An unexpected error occurred while saving attendance.",
                details = ex.Message
            });
        }
    }

    [HttpGet("{id:guid}/attendance")]
    public async Task<ActionResult<IEnumerable<AttendanceRecord>>> GetAttendance(Guid id, CancellationToken cancellationToken)
    {
        if (id == Guid.Empty)
            return BadRequest(new { message = "Invalid scholar ID." });

        try
        {
            // No records yet is a normal state for a scholar (e.g. a brand-new one),
            // not an error — return 200 with an empty list rather than 404.
            var attendance = await _scholarDataAccess.GetAttendanceByScholarIdAsync(id, cancellationToken);

            _logger.LogInformation("Fetched attendance for scholar {ScholarId} ({Count} records)", id, attendance.Count);
            return Ok(attendance);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error fetching attendance for scholar ID: {ScholarId}", id);
            return StatusCode(500, new
            {
                message = "An unexpected error occurred while retrieving attendance.",
                details = ex.Message
            });
        }
    }

    [HttpDelete("{id:guid}/attendance")]
    public async Task<IActionResult> DeleteAttendance(Guid id, CancellationToken cancellationToken)
    {
        if (id == Guid.Empty)
            return BadRequest(new { message = "Invalid scholar ID." });

        try
        {
            var deleted = await _scholarDataAccess.DeleteAttendanceAsync(id, cancellationToken);
            if (!deleted)
            {
                _logger.LogWarning("No attendance record found to delete for scholar {ScholarId}", id);
                return NotFound(new { message = $"No attendance record found for scholar {id}." });
            }

            _logger.LogInformation("Deleted attendance for scholar {ScholarId}", id);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error deleting attendance for scholar ID: {ScholarId}", id);
            return StatusCode(500, new
            {
                message = "An unexpected error occurred while deleting attendance.",
                details = ex.Message
            });
        }
    }

    [HttpGet("attendance")]
    public async Task<ActionResult<IEnumerable<object>>> GetAllAttendance(CancellationToken cancellationToken)
    {
        try
        {
            var allAttendance = await _scholarDataAccess.GetAllAttendanceAsync(cancellationToken);

            var result = allAttendance.Select(a => new
            {
                ScholarId = a.ScholarId,
                Attendance = a.Attendance
            });

            _logger.LogInformation("Retrieved attendance for {Count} scholars.", result.Count());
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error retrieving all attendance records.");
            return StatusCode(500, new
            {
                message = "An unexpected error occurred while fetching all attendance records.",
                details = ex.Message
            });
        }
    }

}
