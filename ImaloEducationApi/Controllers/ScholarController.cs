using ImaloEducationApi.Data;
using ImaloEducationApi.Models;
using Microsoft.AspNetCore.Mvc;

namespace ImaloEducationApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ScholarsController : ControllerBase
    {
        private readonly ScholarDataAccess _scholarDataAccess;
        private readonly ILogger<ScholarsController> _logger;

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

        [HttpGet("{id}")]
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
    }
}
