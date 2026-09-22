using System.Data;
using System.Text.Json;
using ImaloEducationApi.Models;
using Microsoft.Data.SqlClient;

namespace ImaloEducationApi.Data;

public class ScholarDataAccess : IScholarDataAccess
{
    private readonly string _connectionString;
    private readonly ILogger<ScholarDataAccess> _logger;

    public ScholarDataAccess(IConfiguration configuration, ILogger<ScholarDataAccess> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
                            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is missing.");
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    private static object ToDbValue(string? value) =>
        string.IsNullOrWhiteSpace(value) ? DBNull.Value : value;

    private static void AddParam(SqlCommand cmd, string name, SqlDbType type, object value, int size = 0)
    {
        var param = size > 0 ? cmd.Parameters.Add(name, type, size) : cmd.Parameters.Add(name, type);
        param.Value = value;
    }

    public async Task<Scholar> CreateScholarAsync(Scholar scholar, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(scholar);

        const string insertScholarSql = """

                                                INSERT INTO Scholars (FirstName, LastName, DateOfBirth, Grade, SchoolId)
                                                OUTPUT INSERTED.Id
                                                VALUES (@FirstName, @LastName, @DateOfBirth, @Grade, @SchoolId);
                                        """;

        const string insertScheduleSql = """

                                                 INSERT INTO PickUpSchedule (ScholarId, ScheduleJson)
                                                 VALUES (@ScholarId, @ScheduleJson);
                                         """;

        const string insertParentSql = """
                                        INSERT INTO Parents (ScholarId, Role, FirstName, LastName, PhoneNumber)
                                        VALUES (@ScholarId, @Role, @FirstName, @LastName, @PhoneNumber);
                                        """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            await using var insertScholarCmd = new SqlCommand(insertScholarSql, connection, transaction);
            AddParam(insertScholarCmd, "@FirstName", SqlDbType.NVarChar, scholar.FirstName, 100);
            AddParam(insertScholarCmd, "@LastName", SqlDbType.NVarChar, scholar.LastName ?? string.Empty, 100);
            AddParam(insertScholarCmd, "@DateOfBirth", SqlDbType.Date, scholar.DateOfBirth);
            AddParam(insertScholarCmd, "@Grade", SqlDbType.TinyInt, (object?)scholar.Grade ?? DBNull.Value);
            AddParam(insertScholarCmd, "@SchoolId", SqlDbType.Int, (object?)scholar.SchoolId ?? DBNull.Value);

            var insertedIdObj = await insertScholarCmd.ExecuteScalarAsync(cancellationToken);
            if (insertedIdObj is not Guid insertedId)
            {
                await transaction.RollbackAsync(cancellationToken);
                _logger.LogError("Failed to get the inserted scholar ID.");
                throw new InvalidOperationException("Scholar was inserted, but no ID was returned.");
            }

            scholar.Id = insertedId;
            _logger.LogInformation("Scholar created with ID: {ScholarId}", insertedId);

            // Insert pickup schedule if provided
            if (scholar.PickUpSchedule != null && scholar.PickUpSchedule.Count > 0)
            {
                await using var insertScheduleCmd = new SqlCommand(insertScheduleSql, connection, transaction);
                AddParam(insertScheduleCmd, "@ScholarId", SqlDbType.UniqueIdentifier, insertedId);
                AddParam(insertScheduleCmd, "@ScheduleJson", SqlDbType.NVarChar,
                    JsonSerializer.Serialize(scholar.PickUpSchedule), -1);

                await insertScheduleCmd.ExecuteNonQueryAsync(cancellationToken);
                _logger.LogInformation("Pickup schedule inserted for scholar ID: {ScholarId}", insertedId);
            }

            // Insert parent rows for whichever of Mother/Father has at least one field
            // set — every field of a parent is independently optional, so a row is only
            // created once there's actually something to store.
            foreach (var (role, firstName, lastName, phoneNumber) in new[]
                     {
                         ("Mother", scholar.MotherFirstName, scholar.MotherLastName, scholar.MotherPhoneNumber),
                         ("Father", scholar.FatherFirstName, scholar.FatherLastName, scholar.FatherPhoneNumber),
                     })
            {
                if (string.IsNullOrWhiteSpace(firstName) && string.IsNullOrWhiteSpace(lastName) &&
                    string.IsNullOrWhiteSpace(phoneNumber)) continue;

                await using var insertParentCmd = new SqlCommand(insertParentSql, connection, transaction);
                AddParam(insertParentCmd, "@ScholarId", SqlDbType.UniqueIdentifier, insertedId);
                AddParam(insertParentCmd, "@Role", SqlDbType.NVarChar, role, 10);
                AddParam(insertParentCmd, "@FirstName", SqlDbType.NVarChar, ToDbValue(firstName), 100);
                AddParam(insertParentCmd, "@LastName", SqlDbType.NVarChar, ToDbValue(lastName), 100);
                AddParam(insertParentCmd, "@PhoneNumber", SqlDbType.NVarChar, ToDbValue(phoneNumber), 20);
                await insertParentCmd.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);

            // Best-effort: runs after the transaction has committed, on its own
            // connection, so a logging failure can never roll back a successful create.
            await LogAuditAsync(insertedId, "Created", null, cancellationToken);

            return scholar;
        }
        catch (SqlException ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "SQL error occurred while inserting scholar or pickup schedule.");
            throw new Exception("A database error occurred while creating the scholar.", ex);
        }
        catch (Exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<IEnumerable<Scholar>> GetScholarsAsync(CancellationToken cancellationToken)
    {
        // Parents is joined via OUTER APPLY, not a plain LEFT JOIN — a LEFT JOIN straight
        // to Parents would duplicate the scholar row when both a Mother and a Father row
        // exist, and OUTER APPLY is how to pull more than one column per role without that.
        const string sql = """

                                           SELECT s.Id, s.FirstName, s.LastName, s.DateOfBirth, s.Grade, s.SchoolId, ps.ScheduleJson,
                                                  mother.FirstName AS MotherFirstName, mother.LastName AS MotherLastName, mother.PhoneNumber AS MotherPhoneNumber,
                                                  father.FirstName AS FatherFirstName, father.LastName AS FatherLastName, father.PhoneNumber AS FatherPhoneNumber
                                           FROM Scholars s
                                           LEFT JOIN PickUpSchedule ps ON s.Id = ps.ScholarId
                                           OUTER APPLY (SELECT TOP 1 FirstName, LastName, PhoneNumber FROM Parents WHERE ScholarId = s.Id AND Role = 'Mother') AS mother
                                           OUTER APPLY (SELECT TOP 1 FirstName, LastName, PhoneNumber FROM Parents WHERE ScholarId = s.Id AND Role = 'Father') AS father;
                           """;

        var scholars = new List<Scholar>();

        await using var connection = new SqlConnection(_connectionString);
        await using var command = new SqlCommand(sql, connection);

        try
        {
            await connection.OpenAsync(cancellationToken);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
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

    public async Task<Scholar?> GetScholarByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        if (id == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(id));

        const string sql = """

                                           SELECT s.Id, s.FirstName, s.LastName, s.DateOfBirth, s.Grade, s.SchoolId, ps.ScheduleJson,
                                                  mother.FirstName AS MotherFirstName, mother.LastName AS MotherLastName, mother.PhoneNumber AS MotherPhoneNumber,
                                                  father.FirstName AS FatherFirstName, father.LastName AS FatherLastName, father.PhoneNumber AS FatherPhoneNumber
                                           FROM Scholars s
                                           LEFT JOIN PickUpSchedule ps ON s.Id = ps.ScholarId
                                           OUTER APPLY (SELECT TOP 1 FirstName, LastName, PhoneNumber FROM Parents WHERE ScholarId = s.Id AND Role = 'Mother') AS mother
                                           OUTER APPLY (SELECT TOP 1 FirstName, LastName, PhoneNumber FROM Parents WHERE ScholarId = s.Id AND Role = 'Father') AS father
                                           WHERE s.Id = @Id;
                           """;

        await using var connection = new SqlConnection(_connectionString);
        await using var command = new SqlCommand(sql, connection);
        AddParam(command, "@Id", SqlDbType.UniqueIdentifier, id);

        try
        {
            await connection.OpenAsync(cancellationToken);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            if (await reader.ReadAsync(cancellationToken))
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

    public async Task<Scholar?> UpdateScholarAsync(Scholar scholar, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(scholar);
        if (scholar.Id == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholar));

        const string updateScholarSql = """

                                                UPDATE Scholars
                                                SET FirstName = @FirstName,
                                                    LastName = @LastName,
                                                    DateOfBirth = @DateOfBirth,
                                                    Grade = @Grade,
                                                    SchoolId = @SchoolId
                                                WHERE Id = @Id;
                                        """;

        const string updateScheduleSql = """

                                                 IF EXISTS (SELECT 1 FROM PickUpSchedule WHERE ScholarId = @Id)
                                                     UPDATE PickUpSchedule
                                                     SET ScheduleJson = @ScheduleJson
                                                     WHERE ScholarId = @Id
                                                 ELSE
                                                     INSERT INTO PickUpSchedule (ScholarId, ScheduleJson)
                                                     VALUES (@Id, @ScheduleJson);
                                         """;

        const string upsertParentSql = """
                                        IF EXISTS (SELECT 1 FROM Parents WHERE ScholarId = @Id AND Role = @Role)
                                            UPDATE Parents
                                            SET FirstName = @FirstName, LastName = @LastName, PhoneNumber = @PhoneNumber
                                            WHERE ScholarId = @Id AND Role = @Role
                                        ELSE
                                            INSERT INTO Parents (ScholarId, Role, FirstName, LastName, PhoneNumber)
                                            VALUES (@Id, @Role, @FirstName, @LastName, @PhoneNumber);
                                        """;

        const string deleteParentSql = "DELETE FROM Parents WHERE ScholarId = @Id AND Role = @Role;";

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            await using var updateScholarCmd = new SqlCommand(updateScholarSql, connection, transaction);
            AddParam(updateScholarCmd, "@Id", SqlDbType.UniqueIdentifier, scholar.Id);
            AddParam(updateScholarCmd, "@FirstName", SqlDbType.NVarChar, scholar.FirstName ?? string.Empty, 100);
            AddParam(updateScholarCmd, "@LastName", SqlDbType.NVarChar, scholar.LastName ?? string.Empty, 100);
            AddParam(updateScholarCmd, "@DateOfBirth", SqlDbType.Date, scholar.DateOfBirth);
            AddParam(updateScholarCmd, "@Grade", SqlDbType.TinyInt, (object?)scholar.Grade ?? DBNull.Value);
            AddParam(updateScholarCmd, "@SchoolId", SqlDbType.Int, (object?)scholar.SchoolId ?? DBNull.Value);

            var rowsAffected = await updateScholarCmd.ExecuteNonQueryAsync(cancellationToken);
            if (rowsAffected == 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                _logger.LogWarning("No scholar found to update with ID: {ScholarId}", scholar.Id);
                return null; // Scholar not found
            }

            // Update or insert pickup schedule if provided
            if (scholar.PickUpSchedule != null)
            {
                await using var updateScheduleCmd = new SqlCommand(updateScheduleSql, connection, transaction);
                AddParam(updateScheduleCmd, "@Id", SqlDbType.UniqueIdentifier, scholar.Id);
                AddParam(updateScheduleCmd, "@ScheduleJson", SqlDbType.NVarChar,
                    JsonSerializer.Serialize(scholar.PickUpSchedule), -1);
                await updateScheduleCmd.ExecuteNonQueryAsync(cancellationToken);
                _logger.LogInformation("Updated pickup schedule for scholar ID: {ScholarId}", scholar.Id);
            }

            // Upsert whichever of Mother/Father has at least one field set, delete the row
            // for whichever has none (clearing every field on the form removes that parent).
            foreach (var (role, firstName, lastName, phoneNumber) in new[]
                     {
                         ("Mother", scholar.MotherFirstName, scholar.MotherLastName, scholar.MotherPhoneNumber),
                         ("Father", scholar.FatherFirstName, scholar.FatherLastName, scholar.FatherPhoneNumber),
                     })
            {
                var isEmpty = string.IsNullOrWhiteSpace(firstName) && string.IsNullOrWhiteSpace(lastName) &&
                              string.IsNullOrWhiteSpace(phoneNumber);

                if (isEmpty)
                {
                    await using var deleteParentCmd = new SqlCommand(deleteParentSql, connection, transaction);
                    AddParam(deleteParentCmd, "@Id", SqlDbType.UniqueIdentifier, scholar.Id);
                    AddParam(deleteParentCmd, "@Role", SqlDbType.NVarChar, role, 10);
                    await deleteParentCmd.ExecuteNonQueryAsync(cancellationToken);
                }
                else
                {
                    await using var upsertParentCmd = new SqlCommand(upsertParentSql, connection, transaction);
                    AddParam(upsertParentCmd, "@Id", SqlDbType.UniqueIdentifier, scholar.Id);
                    AddParam(upsertParentCmd, "@Role", SqlDbType.NVarChar, role, 10);
                    AddParam(upsertParentCmd, "@FirstName", SqlDbType.NVarChar, ToDbValue(firstName), 100);
                    AddParam(upsertParentCmd, "@LastName", SqlDbType.NVarChar, ToDbValue(lastName), 100);
                    AddParam(upsertParentCmd, "@PhoneNumber", SqlDbType.NVarChar, ToDbValue(phoneNumber), 20);
                    await upsertParentCmd.ExecuteNonQueryAsync(cancellationToken);
                }
            }

            await transaction.CommitAsync(cancellationToken);

            await LogAuditAsync(scholar.Id, "Edited", null, cancellationToken);

            _logger.LogInformation("Updated scholar with ID: {ScholarId}", scholar.Id);
            return scholar;
        }
        catch (SqlException ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "SQL error occurred while updating scholar with ID: {ScholarId}", scholar.Id);
            throw;
        }
        catch (Exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<bool> DeleteScholarAsync(Guid id, CancellationToken cancellationToken)
    {
        if (id == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(id));

        // PickUpSchedule, Attendance and Parents all have ON DELETE CASCADE back to
        // Scholars (see their .sql table definitions), so deleting the Scholars row
        // is enough on its own — no need to delete the child rows here first.
        const string deleteScholarSql = "DELETE FROM Scholars WHERE Id = @Id;";

        await using var connection = new SqlConnection(_connectionString);
        await using var command = new SqlCommand(deleteScholarSql, connection);
        AddParam(command, "@Id", SqlDbType.UniqueIdentifier, id);

        try
        {
            await connection.OpenAsync(cancellationToken);

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);

            if (rowsAffected == 0)
            {
                _logger.LogWarning("No scholar found to delete with ID: {ScholarId}", id);
                return false; // Scholar not found
            }

            await LogAuditAsync(id, "Deleted", null, cancellationToken);

            _logger.LogInformation("Deleted scholar with ID: {ScholarId}", id);
            return true;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "SQL error occurred while deleting scholar with ID: {ScholarId}", id);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error deleting scholar with ID: {ScholarId}", id);
            throw;
        }
    }

    // -----------------------------
    // Attendance management methods
    // -----------------------------

    public async Task<bool> CreateOrUpdateAttendanceAsync(Guid scholarId, List<AttendanceRecord> attendanceRecords,
        CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholarId));

        ArgumentNullException.ThrowIfNull(attendanceRecords);

        const string upsertAttendanceSql = """
                                           IF EXISTS (SELECT 1 FROM Attendance WHERE ScholarId = @ScholarId)
                                               UPDATE Attendance
                                               SET AttendanceJson = @AttendanceJson
                                               WHERE ScholarId = @ScholarId;
                                           ELSE
                                               INSERT INTO Attendance (ScholarId, AttendanceJson)
                                               VALUES (@ScholarId, @AttendanceJson);
                                           """;

        await using var connection = new SqlConnection(_connectionString);
        await using var command = new SqlCommand(upsertAttendanceSql, connection);

        AddParam(command, "@ScholarId", SqlDbType.UniqueIdentifier, scholarId);
        AddParam(command, "@AttendanceJson", SqlDbType.NVarChar, JsonSerializer.Serialize(attendanceRecords), -1);

        try
        {
            await connection.OpenAsync(cancellationToken);
            await command.ExecuteNonQueryAsync(cancellationToken);

            _logger.LogInformation("Attendance record upserted for scholar ID: {ScholarId}", scholarId);
            return true;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "SQL error while creating or updating attendance for scholar ID: {ScholarId}", scholarId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while creating/updating attendance for scholar ID: {ScholarId}", scholarId);
            throw;
        }
    }

    public async Task<List<AttendanceRecord>> GetAttendanceByScholarIdAsync(Guid scholarId,
        CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholarId));

        const string sql = "SELECT AttendanceJson FROM Attendance WHERE ScholarId = @ScholarId;";

        await using var connection = new SqlConnection(_connectionString);
        await using var command = new SqlCommand(sql, connection);
        AddParam(command, "@ScholarId", SqlDbType.UniqueIdentifier, scholarId);

        try
        {
            await connection.OpenAsync(cancellationToken);
            var result = await command.ExecuteScalarAsync(cancellationToken);

            if (result == null || result == DBNull.Value)
            {
                _logger.LogInformation("No attendance found for scholar ID: {ScholarId}", scholarId);
                return new List<AttendanceRecord>();
            }

            var json = result.ToString();
            return JsonSerializer.Deserialize<List<AttendanceRecord>>(json!,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<AttendanceRecord>();
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Invalid JSON found for scholar ID {ScholarId}", scholarId);
            throw new Exception("Corrupted attendance JSON in database.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "SQL error while fetching attendance for scholar ID {ScholarId}", scholarId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while fetching attendance for scholar ID: {ScholarId}", scholarId);
            throw;
        }
    }

    public async Task<IEnumerable<(Guid ScholarId, List<AttendanceRecord> Attendance)>> GetAllAttendanceAsync(
        CancellationToken cancellationToken)
    {
        const string sql = "SELECT ScholarId, AttendanceJson FROM Attendance;";

        var results = new List<(Guid, List<AttendanceRecord>)>();

        await using var connection = new SqlConnection(_connectionString);
        await using var command = new SqlCommand(sql, connection);

        try
        {
            await connection.OpenAsync(cancellationToken);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                var scholarId = reader.GetGuid(reader.GetOrdinal("ScholarId"));
                var json = reader.GetString(reader.GetOrdinal("AttendanceJson"));

                try
                {
                    var records = JsonSerializer.Deserialize<List<AttendanceRecord>>(json,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<AttendanceRecord>();
                    results.Add((scholarId, records));
                }
                catch (JsonException ex)
                {
                    _logger.LogWarning(ex, "Failed to parse attendance JSON for scholar {ScholarId}", scholarId);
                }
            }

            _logger.LogInformation("Fetched attendance for {Count} scholars.", results.Count);
            return results;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "SQL error occurred while fetching all attendance.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error fetching all attendance.");
            throw;
        }
    }

    public async Task<bool> DeleteAttendanceAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholarId));

        const string sql = "DELETE FROM Attendance WHERE ScholarId = @ScholarId;";

        await using var connection = new SqlConnection(_connectionString);
        await using var command = new SqlCommand(sql, connection);
        AddParam(command, "@ScholarId", SqlDbType.UniqueIdentifier, scholarId);

        try
        {
            await connection.OpenAsync(cancellationToken);
            var rows = await command.ExecuteNonQueryAsync(cancellationToken);

            if (rows > 0)
            {
                _logger.LogInformation("Deleted attendance for scholar ID: {ScholarId}", scholarId);
                return true;
            }

            _logger.LogWarning("No attendance found to delete for scholar ID: {ScholarId}", scholarId);
            return false;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "SQL error while deleting attendance for scholar ID: {ScholarId}", scholarId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error deleting attendance for scholar ID: {ScholarId}", scholarId);
            throw;
        }
    }

    // ---------------------------
    // Audit log
    // ---------------------------

    // Writing an audit entry is best-effort: it always runs after the scholar
    // mutation it's recording has already succeeded (and, for Create/Update,
    // after that mutation's own transaction has committed), so a DB hiccup
    // while writing the log must never turn an otherwise-successful request
    // into a 500 — it's swallowed and logged instead. Uses its own connection
    // rather than sharing the caller's, for the same reason.
    private async Task LogAuditAsync(Guid scholarId, string action, string? details, CancellationToken cancellationToken)
    {
        const string sql = """
                            INSERT INTO ScholarAuditLog (ScholarId, Action, Details, ActionDate)
                            VALUES (@ScholarId, @Action, @Details, SYSUTCDATETIME());
                            """;

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await using var command = new SqlCommand(sql, connection);

            AddParam(command, "@ScholarId", SqlDbType.UniqueIdentifier, scholarId);
            AddParam(command, "@Action", SqlDbType.NVarChar, action, 50);
            AddParam(command, "@Details", SqlDbType.NVarChar, ToDbValue(details), 500);

            await connection.OpenAsync(cancellationToken);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write audit log entry for scholar {ScholarId}, action {Action}",
                scholarId, action);
        }
    }

    public async Task<List<AuditLogEntry>> GetAuditLogByScholarIdAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholarId));

        const string sql = """
                            SELECT AuditId, ScholarId, Action, Details, ActionDate
                            FROM ScholarAuditLog
                            WHERE ScholarId = @ScholarId
                            ORDER BY ActionDate DESC, AuditId DESC;
                            """;

        var entries = new List<AuditLogEntry>();

        await using var connection = new SqlConnection(_connectionString);
        await using var command = new SqlCommand(sql, connection);
        AddParam(command, "@ScholarId", SqlDbType.UniqueIdentifier, scholarId);

        try
        {
            await connection.OpenAsync(cancellationToken);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                entries.Add(new AuditLogEntry
                {
                    AuditId = reader.GetInt32(reader.GetOrdinal("AuditId")),
                    ScholarId = reader.GetGuid(reader.GetOrdinal("ScholarId")),
                    Action = reader.GetString(reader.GetOrdinal("Action")),
                    Details = reader.IsDBNull(reader.GetOrdinal("Details"))
                        ? null
                        : reader.GetString(reader.GetOrdinal("Details")),
                    ActionDate = reader.GetDateTime(reader.GetOrdinal("ActionDate")),
                });
            }

            _logger.LogInformation("Fetched {Count} audit log entries for scholar {ScholarId}.", entries.Count,
                scholarId);
            return entries;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "SQL error while fetching audit log for scholar ID {ScholarId}.", scholarId);
            throw;
        }
    }

    public async Task<PagedResult<GlobalAuditLogEntry>> GetAllAuditLogAsync(int pageNumber, int pageSize,
        CancellationToken cancellationToken)
    {
        // LEFT JOIN, not INNER: ScholarAuditLog has no FK to Scholars (a deleted
        // scholar's history must survive the delete — see ScholarAuditLog.sql), so
        // FirstName/LastName come back NULL for a scholar that no longer exists
        // rather than dropping that row.
        const string countSql = "SELECT COUNT(*) FROM ScholarAuditLog;";

        const string pageSql = """
                            SELECT
                                l.AuditId, l.ScholarId, s.FirstName, s.LastName, l.Action, l.Details, l.ActionDate
                            FROM ScholarAuditLog AS l
                            LEFT JOIN Scholars AS s ON s.Id = l.ScholarId
                            ORDER BY l.ActionDate DESC, l.AuditId DESC
                            OFFSET (@PageNumber - 1) * @PageSize ROWS
                            FETCH NEXT @PageSize ROWS ONLY;
                            """;

        var result = new PagedResult<GlobalAuditLogEntry> { PageNumber = pageNumber, PageSize = pageSize };

        await using var connection = new SqlConnection(_connectionString);

        try
        {
            await connection.OpenAsync(cancellationToken);

            // Fetched independently of the page query below, so TotalItems is always
            // correct even when the requested page itself has zero rows (past the
            // last page, or the log was just cleared) — a COUNT(*) OVER() window
            // column on the page query only reflects the total when at least one row
            // comes back.
            await using (var countCmd = new SqlCommand(countSql, connection))
            {
                result.TotalItems = (int)(await countCmd.ExecuteScalarAsync(cancellationToken))!;
            }

            await using var pageCmd = new SqlCommand(pageSql, connection);
            AddParam(pageCmd, "@PageNumber", SqlDbType.Int, pageNumber);
            AddParam(pageCmd, "@PageSize", SqlDbType.Int, pageSize);

            await using var reader = await pageCmd.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                result.Items.Add(new GlobalAuditLogEntry
                {
                    AuditId = reader.GetInt32(reader.GetOrdinal("AuditId")),
                    ScholarId = reader.GetGuid(reader.GetOrdinal("ScholarId")),
                    FirstName = reader.IsDBNull(reader.GetOrdinal("FirstName"))
                        ? null
                        : reader.GetString(reader.GetOrdinal("FirstName")),
                    LastName = reader.IsDBNull(reader.GetOrdinal("LastName"))
                        ? null
                        : reader.GetString(reader.GetOrdinal("LastName")),
                    Action = reader.GetString(reader.GetOrdinal("Action")),
                    Details = reader.IsDBNull(reader.GetOrdinal("Details"))
                        ? null
                        : reader.GetString(reader.GetOrdinal("Details")),
                    ActionDate = reader.GetDateTime(reader.GetOrdinal("ActionDate")),
                });
            }

            _logger.LogInformation("Fetched page {PageNumber} ({Count} of {Total}) of the global audit log.",
                pageNumber, result.Items.Count, result.TotalItems);
            return result;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "SQL error while fetching the global audit log.");
            throw;
        }
    }

    public async Task DeleteAllAuditLogAsync(CancellationToken cancellationToken)
    {
        const string sql = "DELETE FROM ScholarAuditLog;";

        await using var connection = new SqlConnection(_connectionString);
        await using var command = new SqlCommand(sql, connection);

        try
        {
            await connection.OpenAsync(cancellationToken);
            var rows = await command.ExecuteNonQueryAsync(cancellationToken);

            _logger.LogInformation("Cleared the audit log ({Count} entries deleted).", rows);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "SQL error while clearing the audit log.");
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
                DateOfBirth = reader.GetFieldValue<DateOnly>(reader.GetOrdinal("DateOfBirth")),
                Grade =
                    reader.IsDBNull(reader.GetOrdinal("Grade")) ? null : reader.GetByte(reader.GetOrdinal("Grade")),
                SchoolId = reader.IsDBNull(reader.GetOrdinal("SchoolId"))
                    ? null
                    : reader.GetInt32(reader.GetOrdinal("SchoolId")),
                MotherFirstName = reader.IsDBNull(reader.GetOrdinal("MotherFirstName"))
                    ? null
                    : reader.GetString(reader.GetOrdinal("MotherFirstName")),
                MotherLastName = reader.IsDBNull(reader.GetOrdinal("MotherLastName"))
                    ? null
                    : reader.GetString(reader.GetOrdinal("MotherLastName")),
                MotherPhoneNumber = reader.IsDBNull(reader.GetOrdinal("MotherPhoneNumber"))
                    ? null
                    : reader.GetString(reader.GetOrdinal("MotherPhoneNumber")),
                FatherFirstName = reader.IsDBNull(reader.GetOrdinal("FatherFirstName"))
                    ? null
                    : reader.GetString(reader.GetOrdinal("FatherFirstName")),
                FatherLastName = reader.IsDBNull(reader.GetOrdinal("FatherLastName"))
                    ? null
                    : reader.GetString(reader.GetOrdinal("FatherLastName")),
                FatherPhoneNumber = reader.IsDBNull(reader.GetOrdinal("FatherPhoneNumber"))
                    ? null
                    : reader.GetString(reader.GetOrdinal("FatherPhoneNumber")),
            };

            if (reader.IsDBNull(reader.GetOrdinal("ScheduleJson"))) return scholar;

            var json = reader.GetString(reader.GetOrdinal("ScheduleJson"));
            scholar.PickUpSchedule = JsonSerializer.Deserialize<Dictionary<string, string?>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

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
