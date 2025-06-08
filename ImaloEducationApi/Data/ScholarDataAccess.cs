using ImaloEducationApi.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using System.Data;
using System.Text.Json;

namespace ImaloEducationApi.Data
{
    public class ScholarDataAccess
    {
        private readonly string _connectionString;
        private readonly ILogger<ScholarDataAccess> _logger;

        public ScholarDataAccess(IConfiguration configuration, ILogger<ScholarDataAccess> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is missing.");
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<Scholar> CreateScholarAsync(Scholar scholar)
        {
            if (scholar == null)
                throw new ArgumentNullException(nameof(scholar));

            const string sql = @"
                INSERT INTO Scholars (FirstName, LastName, DateOfBirth, Grade, SchoolId)
                OUTPUT INSERTED.Id
                VALUES (@FirstName, @LastName, @DateOfBirth, @Grade, @SchoolId);";

            using var connection = new SqlConnection(_connectionString);
            using var command = new SqlCommand(sql, connection);

            command.Parameters.AddWithValue("@FirstName", scholar.FirstName ?? string.Empty);
            command.Parameters.AddWithValue("@LastName", scholar.LastName ?? string.Empty);
            command.Parameters.AddWithValue("@DateOfBirth", scholar.DateOfBirth);
            command.Parameters.AddWithValue("@Grade", (object?)scholar.Grade ?? DBNull.Value);
            command.Parameters.AddWithValue("@SchoolId", (object?)scholar.SchoolId ?? DBNull.Value);

            try
            {
                await connection.OpenAsync();
                var result = await command.ExecuteScalarAsync();

                if (result is Guid id)
                {
                    scholar.Id = id;
                    _logger.LogInformation("Scholar created with ID: {ScholarId}", id);
                    return scholar;
                }

                _logger.LogError("Failed to get the inserted scholar ID.");
                throw new InvalidOperationException("Scholar was inserted, but no ID was returned.");
            }
            catch (SqlException ex)
            {
                _logger.LogError(ex, "SQL error occurred while inserting scholar.");
                throw new Exception("A database error occurred while creating the scholar.", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error during scholar creation.");
                throw;
            }
        }

        public async Task<IEnumerable<Scholar>> GetScholarsAsync()
        {
            const string sql = @"
                SELECT s.Id, s.FirstName, s.LastName, s.DateOfBirth, s.Grade, s.SchoolId, ps.ScheduleJson
                FROM Scholars s
                LEFT JOIN PickUpSchedule ps ON s.Id = ps.ScholarId;";

            var scholars = new List<Scholar>();

            using var connection = new SqlConnection(_connectionString);
            using var command = new SqlCommand(sql, connection);

            try
            {
                await connection.OpenAsync();
                using var reader = await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    var scholar = TryMapScholarFromReader(reader);
                    if (scholar != null)
                        scholars.Add(scholar);
                }

                _logger.LogInformation("Fetched {Count} scholars.", scholars.Count);
                return scholars;
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Error parsing JSON for pickup schedule.");
                throw new Exception("Failed to parse pickup schedule data from the database.", ex);
            }
            catch (SqlException ex)
            {
                _logger.LogError(ex, "Database error occurred while fetching scholars.");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error fetching scholars.");
                throw;
            }
        }

        public async Task<Scholar?> GetScholarByIdAsync(Guid id)
        {
            if (id == Guid.Empty)
                throw new ArgumentException("Scholar ID must not be empty.", nameof(id));

            const string sql = @"
                SELECT s.Id, s.FirstName, s.LastName, s.DateOfBirth, s.Grade, s.SchoolId, ps.ScheduleJson
                FROM Scholars s
                LEFT JOIN PickUpSchedule ps ON s.Id = ps.ScholarId
                WHERE s.Id = @Id;";

            using var connection = new SqlConnection(_connectionString);
            using var command = new SqlCommand(sql, connection);
            command.Parameters.AddWithValue("@Id", id);

            try
            {
                await connection.OpenAsync();
                using var reader = await command.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    var scholar = TryMapScholarFromReader(reader);
                    _logger.LogInformation("Retrieved scholar with ID: {ScholarId}", id);
                    return scholar;
                }

                _logger.LogWarning("No scholar found with ID: {ScholarId}", id);
                return null;
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "JSON error while fetching scholar ID {ScholarId}.", id);
                throw new Exception("Corrupted pickup schedule data.", ex);
            }
            catch (SqlException ex)
            {
                _logger.LogError(ex, "SQL error while fetching scholar by ID {ScholarId}.", id);
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error retrieving scholar by ID: {ScholarId}", id);
                throw;
            }
        }

        private Scholar? TryMapScholarFromReader(SqlDataReader reader)
        {
            try
            {
                var scholar = new Scholar
                {
                    Id = reader.GetGuid(reader.GetOrdinal("Id")),
                    FirstName = reader.GetString(reader.GetOrdinal("FirstName")),
                    LastName = reader.GetString(reader.GetOrdinal("LastName")),
                    DateOfBirth = reader.GetDateTime(reader.GetOrdinal("DateOfBirth")),
                    Grade = reader.IsDBNull(reader.GetOrdinal("Grade")) ? null : reader.GetInt32(reader.GetOrdinal("Grade")),
                    SchoolId = reader.IsDBNull(reader.GetOrdinal("SchoolId")) ? null : reader.GetInt32(reader.GetOrdinal("SchoolId")),
                };

                if (!reader.IsDBNull(reader.GetOrdinal("ScheduleJson")))
                {
                    var json = reader.GetString(reader.GetOrdinal("ScheduleJson"));
                    scholar.PickUpSchedule = JsonSerializer.Deserialize<Dictionary<string, string>>(json,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }

                return scholar;
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Failed to deserialize pickup schedule for scholar row.");
                return null; // Skip malformed data
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error mapping scholar from reader.");
                throw;
            }
        }
    }
}
