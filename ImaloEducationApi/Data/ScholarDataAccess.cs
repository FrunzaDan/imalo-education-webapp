
using ImaloEducationApi.Models;
using Microsoft.Data.SqlClient;
using System.Data;
using System.Text.Json;

namespace ImaloEducationApi.Data;

public class ScholarDataAccess
{
    private readonly string _connectionString;
    private readonly ILogger<ScholarDataAccess> _logger;

    public ScholarDataAccess(IConfiguration configuration, ILogger<ScholarDataAccess> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
                            ?? throw new InvalidOperationException("DefaultConnection not found in appsettings.json");
        _logger = logger;
    }

    public async Task<Scholar> CreateScholarAsync(Scholar scholar)
    {
        string sql = @"
                INSERT INTO Scholars (FirstName, LastName, DateOfBirth, Grade, SchoolId)
                OUTPUT INSERTED.Id
                VALUES (@FirstName, @LastName, @DateOfBirth, @Grade, @SchoolId);";


        using (SqlConnection connection = new SqlConnection(_connectionString))
        {
            await connection.OpenAsync();
            using (SqlCommand command = new SqlCommand(sql, connection))
            {
                command.Parameters.Add("@FirstName", SqlDbType.NVarChar, 100).Value = scholar.FirstName;
                command.Parameters.Add("@LastName", SqlDbType.NVarChar, 100).Value = scholar.LastName;
                command.Parameters.Add("@DateOfBirth", SqlDbType.DateTime2).Value = scholar.DateOfBirth;
                command.Parameters.Add("@Grade", SqlDbType.Int).Value = scholar.Grade.HasValue ? (object)scholar.Grade.Value : DBNull.Value;
                command.Parameters.Add("@SchoolId", SqlDbType.Int).Value = scholar.SchoolId.HasValue ? (object)scholar.SchoolId.Value : DBNull.Value;
                try
                {
                    object? result = await command.ExecuteScalarAsync();
                    if (result != null && result != DBNull.Value)
                    {
                        scholar.Id = (Guid)result;
                        _logger.LogInformation("Scholar created successfully with ID: {ScholarId}", scholar.Id);
                        return scholar;
                    }
                    else
                    {
                        _logger.LogError("Failed to retrieve new scholar ID after insertion.");
                        throw new InvalidOperationException("Failed to retrieve new scholar ID after insertion.");
                    }
                }
                catch (SqlException ex)
                {
                    _logger.LogError(ex, "Database error creating scholar: {Message}", ex.Message);
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "An unexpected error occurred while creating scholar: {Message}", ex.Message);
                    throw;
                }
            }
        }
    }

    public async Task<IEnumerable<Scholar>> GetScholarsAsync()
    {
        List<Scholar> scholars = new List<Scholar>();
        // LEFT JOIN PickUpSchedule to get ScheduleJson, allowing for scholars without a schedule
        string sql = @"
            SELECT
                s.Id, s.FirstName, s.LastName, s.DateOfBirth, s.Grade, s.SchoolId,
                ps.ScheduleJson
            FROM
                Scholars s
            LEFT JOIN
                PickUpSchedule ps ON s.Id = ps.ScholarId;";

        using (SqlConnection connection = new SqlConnection(_connectionString))
        {
            await connection.OpenAsync();
            using (SqlCommand command = new SqlCommand(sql, connection))
            {
                try
                {
                    using (SqlDataReader reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            Scholar scholar = new Scholar
                            {
                                Id = reader.GetGuid(reader.GetOrdinal("Id")),
                                FirstName = reader.GetString(reader.GetOrdinal("FirstName")),
                                LastName = reader.GetString(reader.GetOrdinal("LastName")),
                                DateOfBirth = reader.GetDateTime(reader.GetOrdinal("DateOfBirth")),
                                Grade = reader.IsDBNull(reader.GetOrdinal("Grade")) ? (int?)null : reader.GetInt32(reader.GetOrdinal("Grade")),
                                SchoolId = reader.IsDBNull(reader.GetOrdinal("SchoolId")) ? (int?)null : reader.GetInt32(reader.GetOrdinal("SchoolId"))
                            };

                            // Check if ScheduleJson is not DBNull before deserializing
                            if (!reader.IsDBNull(reader.GetOrdinal("ScheduleJson")))
                            {
                                string scheduleJson = reader.GetString(reader.GetOrdinal("ScheduleJson"));
                                scholar.PickUpSchedule = JsonSerializer.Deserialize<Dictionary<string, string>>(scheduleJson);
                            }

                            scholars.Add(scholar);
                        }
                    }
                    _logger.LogInformation("Retrieved {Count} scholars from the database.", scholars.Count);
                    return scholars;
                }
                catch (JsonException ex)
                {
                    _logger.LogError(ex, "JSON deserialization error retrieving scholars: {Message}", ex.Message);
                    throw new InvalidOperationException("Error deserializing pickup schedule JSON.", ex);
                }
                catch (SqlException ex)
                {
                    _logger.LogError(ex, "Database error retrieving scholars: {Message}", ex.Message);
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "An unexpected error occurred while retrieving scholars: {Message}", ex.Message);
                    throw;
                }
            }
        }
    }

    public async Task<Scholar?> GetScholarByIdAsync(Guid id)
    {
        // LEFT JOIN PickUpSchedule to get ScheduleJson, allowing for scholars without a schedule
        string sql = @"
            SELECT
                s.Id, s.FirstName, s.LastName, s.DateOfBirth, s.Grade, s.SchoolId,
                ps.ScheduleJson
            FROM
                Scholars s
            LEFT JOIN
                PickUpSchedule ps ON s.Id = ps.ScholarId
            WHERE s.Id = @Id;";

        using (SqlConnection connection = new SqlConnection(_connectionString))
        {
            await connection.OpenAsync();
            using (SqlCommand command = new SqlCommand(sql, connection))
            {
                command.Parameters.Add("@Id", SqlDbType.UniqueIdentifier).Value = id;

                try
                {
                    using (SqlDataReader reader = await command.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            Scholar scholar = new Scholar
                            {
                                Id = reader.GetGuid(reader.GetOrdinal("Id")),
                                FirstName = reader.GetString(reader.GetOrdinal("FirstName")),
                                LastName = reader.GetString(reader.GetOrdinal("LastName")),
                                DateOfBirth = reader.GetDateTime(reader.GetOrdinal("DateOfBirth")),
                                Grade = reader.IsDBNull(reader.GetOrdinal("Grade")) ? (int?)null : reader.GetInt32(reader.GetOrdinal("Grade")),
                                SchoolId = reader.IsDBNull(reader.GetOrdinal("SchoolId")) ? (int?)null : reader.GetInt32(reader.GetOrdinal("SchoolId"))
                            };

                            // Check if ScheduleJson is not DBNull before deserializing
                            if (!reader.IsDBNull(reader.GetOrdinal("ScheduleJson")))
                            {
                                string scheduleJson = reader.GetString(reader.GetOrdinal("ScheduleJson"));
                                scholar.PickUpSchedule = JsonSerializer.Deserialize<Dictionary<string, string>>(scheduleJson);
                            }

                            _logger.LogInformation("Retrieved scholar with ID: {ScholarId}", id);
                            return scholar;
                        }
                        else
                        {
                            _logger.LogWarning("Scholar with ID: {ScholarId} not found.", id);
                            return null;
                        }
                    }
                }
                catch (JsonException ex)
                {
                    _logger.LogError(ex, "JSON deserialization error retrieving scholar by ID {ScholarId}: {Message}", id, ex.Message);
                    throw new InvalidOperationException($"Error deserializing pickup schedule JSON for scholar {id}.", ex);
                }
                catch (SqlException ex)
                {
                    _logger.LogError(ex, "Database error retrieving scholar by ID: {ScholarId} - {Message}", id, ex.Message);
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "An unexpected error occurred while retrieving scholar by ID: {ScholarId} - {Message}", id, ex.Message);
                    throw;
                }
            }
        }
    }
}
