using ImaloEducationApi.Data;
using ImaloEducationApi.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

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
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> CreateScholar([FromBody] Scholar scholar)
        {
            if (scholar == null || string.IsNullOrWhiteSpace(scholar.FirstName) || string.IsNullOrWhiteSpace(scholar.LastName))
            {
                _logger.LogWarning("Invalid scholar data received for creation.");
                return BadRequest("Scholar data is invalid or incomplete.");
            }

            try
            {
                // Call the data access layer to create the scholar
                Scholar createdScholar = await _scholarDataAccess.CreateScholarAsync(scholar);

                // Return a 201 Created status with the newly created scholar object
                // The CreatedAtAction method is used to return a URI to the newly created resource.
                return CreatedAtAction(nameof(GetScholarById), new { id = createdScholar.Id }, createdScholar);
            }
            catch (SqlException ex)
            {
                _logger.LogError(ex, "Database error creating scholar: {Message}", ex.Message);
                return StatusCode(StatusCodes.Status500InternalServerError, "A database error occurred while creating the scholar.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unexpected error occurred while creating scholar: {Message}", ex.Message);
                return StatusCode(StatusCodes.Status500InternalServerError, "An unexpected error occurred.");
            }
        }

        [HttpGet("{id}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<Scholar>> GetScholarById(int id)
        {
            _logger.LogInformation("Attempted to retrieve scholar with ID: {ScholarId}", id);
            return NotFound($"Scholar with ID {id} not found (this is a placeholder method).");
        }
    }
}