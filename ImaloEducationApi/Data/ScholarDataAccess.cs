
using ImaloEducationApi.Models;
using Microsoft.Data.SqlClient;

namespace ImaloEducationApi.Data;

public class ScholarDataAccess
{
    private readonly string _connectionString;
    private readonly ILogger<ScholarDataAccess> _logger; // Added for logging

    public ScholarDataAccess(IConfiguration configuration, ILogger<ScholarDataAccess> logger)
    {
        // Get the connection string from appsettings.json
        _connectionString = configuration.GetConnectionString("DefaultConnection")
                            ?? throw new InvalidOperationException("DefaultConnection not found in appsettings.json");
        _logger = logger;
    }

    public async Task<Scholar> CreateScholarAsync(Scholar scholar)
    {
        string sql = @"
                INSERT INTO Scholars (FirstName, LastName, SchoolId, Grade, BirthDate)
                OUTPUT INSERTED.Id
                VALUES (@FirstName, @LastName, @SchoolId, @Grade, @BirthDate);";

        using (SqlConnection connection = new SqlConnection(_connectionString))
        {
            await connection.OpenAsync();
            using (SqlCommand command = new SqlCommand(sql, connection))
            {
                // Add parameters to prevent SQL injection and map data types
                command.Parameters.Add("@FirstName", SqlDbType.NVarChar, 100).Value = scholar.FirstName;
                command.Parameters.Add("@LastName", SqlDbType.NVarChar, 100).Value = scholar.LastName;
                command.Parameters.Add("@SchoolId", SqlDbType.NVarChar, 50).Value = scholar.SchoolId;
                command.Parameters.Add("@Grade", SqlDbType.Int).Value = scholar.Grade;
                command.Parameters.Add("@BirthDate", SqlDbType.Date).Value = scholar.BirthDate.Date; // Store only date part

                try
                {
                    // ExecuteScalarAsync retrieves the first column of the first row returned by the query,
                    // which is the new ID from OUTPUT INSERTED.Id.
                    object? result = await command.ExecuteScalarAsync();
                    if (result != null && result != DBNull.Value)
                    {
                        scholar.Id = Convert.ToInt32(result); // Assign the new ID to the scholar object
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
                    throw; // Re-throw the exception for the controller to handle
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "An unexpected error occurred while creating scholar: {Message}", ex.Message);
                    throw;
                }
            }
        }
    }
}
