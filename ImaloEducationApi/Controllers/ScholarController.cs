using ImaloEducationApi.Data;
using ImaloEducationApi.Models;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

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
                var errors = new Dictionary<string, string[]>();

                foreach (var key in ModelState.Keys)
                {
                    var state = ModelState[key];
                    if (state is not null && state.Errors.Count > 0)
                    {
                        errors[key] = state.Errors.Select(e => e.ErrorMessage).ToArray();
                    }
                }

                _logger.LogWarning("Invalid model state for CreateScholar request: {@Errors}", errors);

                return BadRequest(new
                {
                    message = "Validation failed for the scholar data.",
                    errors = errors
                });
            }

            try
            {
                Scholar createdScholar = await _scholarDataAccess.CreateScholarAsync(scholar);
                _logger.LogInformation("API: Scholar created successfully with ID: {ScholarId}", createdScholar.Id);
                return CreatedAtAction(nameof(GetScholarById), new { id = createdScholar.Id }, createdScholar);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "API: Error creating scholar due to invalid operation: {Message}", ex.Message);
                return StatusCode(500, new
                {
                    message = "An error occurred while creating the scholar.",
                    details = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "API: An unexpected error occurred while creating scholar: {Message}", ex.Message);
                return StatusCode(500, new
                {
                    message = "An unexpected error occurred while processing your request.",
                    details = ex.Message
                });
            }
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Scholar>>> GetScholars()
        {
            try
            {
                IEnumerable<Scholar> scholars = await _scholarDataAccess.GetScholarsAsync();
                _logger.LogInformation("API: Retrieved {Count} scholars.", ((List<Scholar>)scholars).Count);
                return Ok(scholars);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "API: An unexpected error occurred while retrieving scholars: {Message}", ex.Message);
                return StatusCode(500, "An unexpected error occurred while processing your request.");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Scholar>> GetScholarById(Guid id)
        {
            try
            {
                Scholar? scholar = await _scholarDataAccess.GetScholarByIdAsync(id);

                if (scholar == null)
                {
                    _logger.LogWarning("API: Scholar with ID: {ScholarId} not found.", id);
                    return NotFound();
                }

                _logger.LogInformation("API: Retrieved scholar with ID: {ScholarId}", id);
                return Ok(scholar);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "API: An unexpected error occurred while retrieving scholar by ID: {ScholarId} - {Message}", id, ex.Message);
                return StatusCode(500, "An unexpected error occurred while processing your request.");
            }
        }
    }
}