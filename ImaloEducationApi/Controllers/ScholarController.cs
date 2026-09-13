using ImaloEducationApi.Data;
using ImaloEducationApi.Models;
using Microsoft.AspNetCore.Mvc;

namespace ImaloEducationApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScholarsController : ControllerBase
{
    private readonly ILogger<ScholarsController> _logger;
    private readonly ScholarDataAccess _scholarDataAccess;

    public ScholarsController(ScholarDataAccess scholarDataAccess, ILogger<ScholarsController> logger)
    {
        _scholarDataAccess = scholarDataAccess;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<Scholar>> CreateScholar([FromBody] Scholar scholar)
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
            var createdScholar = await _scholarDataAccess.CreateScholarAsync(scholar);
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
    public async Task<ActionResult<IEnumerable<Scholar>>> GetScholars()
    {
        try
        {
            var scholars = (await _scholarDataAccess.GetScholarsAsync()).ToList();

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
    public async Task<ActionResult<Scholar>> GetScholarById(Guid id)
    {
        try
        {
            var scholar = await _scholarDataAccess.GetScholarByIdAsync(id);

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
    public async Task<IActionResult> UpdateScholar(Guid id, [FromBody] Scholar scholar)
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
            var updatedScholar = await _scholarDataAccess.UpdateScholarAsync(scholar);
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
    public async Task<IActionResult> DeleteScholar(Guid id)
    {
        try
        {
            var deleted = await _scholarDataAccess.DeleteScholarAsync(id);
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
    public async Task<ActionResult<IEnumerable<AuditLogEntry>>> GetScholarAuditLog(Guid id)
    {
        try
        {
            var entries = await _scholarDataAccess.GetAuditLogByScholarIdAsync(id);
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
        [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
    {
        if (pageNumber < 1)
            return BadRequest(new { message = "Page number must be 1 or greater." });

        if (pageSize < 1 || pageSize > 100)
            return BadRequest(new { message = "Page size must be between 1 and 100." });

        try
        {
            var result = await _scholarDataAccess.GetAllAuditLogAsync(pageNumber, pageSize);
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
    public async Task<IActionResult> DeleteAllAuditLog()
    {
        try
        {
            await _scholarDataAccess.DeleteAllAuditLogAsync();
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
    public async Task<IActionResult> CreateOrUpdateAttendance(Guid id, [FromBody] List<AttendanceRecord> attendance)
    {
        if (id == Guid.Empty)
            return BadRequest(new { message = "Invalid scholar ID." });

        if (attendance == null)
            return BadRequest(new { message = "Attendance data is required." });

        try
        {
            var result = await _scholarDataAccess.CreateOrUpdateAttendanceAsync(id, attendance);
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
    public async Task<ActionResult<IEnumerable<AttendanceRecord>>> GetAttendance(Guid id)
    {
        if (id == Guid.Empty)
            return BadRequest(new { message = "Invalid scholar ID." });

        try
        {
            var attendance = await _scholarDataAccess.GetAttendanceByScholarIdAsync(id);
            if (attendance == null || !attendance.Any())
            {
                _logger.LogInformation("No attendance found for scholar {ScholarId}", id);
                return NotFound(new { message = $"No attendance data found for scholar {id}." });
            }

            _logger.LogInformation("Fetched attendance for scholar {ScholarId}", id);
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
    public async Task<IActionResult> DeleteAttendance(Guid id)
    {
        if (id == Guid.Empty)
            return BadRequest(new { message = "Invalid scholar ID." });

        try
        {
            var deleted = await _scholarDataAccess.DeleteAttendanceAsync(id);
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
    public async Task<ActionResult<IEnumerable<object>>> GetAllAttendance()
    {
        try
        {
            var allAttendance = await _scholarDataAccess.GetAllAttendanceAsync();

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