using System.Data;
using System.Text.Json;
using ImaloEducationApi.Models;
using Microsoft.Data.SqlClient;

namespace ImaloEducationApi.Data;

public partial class ScholarDataAccess : IScholarDataAccess
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly ISqlConnectionFactory _connectionFactory;
    private readonly ILogger<ScholarDataAccess> _logger;

    public ScholarDataAccess(ISqlConnectionFactory connectionFactory, ILogger<ScholarDataAccess> logger)
    {
        _connectionFactory = connectionFactory ?? throw new ArgumentNullException(nameof(connectionFactory));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    private static object ToDbValue(string? value) =>
        string.IsNullOrWhiteSpace(value) ? DBNull.Value : value;

    private static void AddParam(SqlCommand command, string name, SqlDbType type, object value, int size = 0)
    {
        var param = size > 0 ? command.Parameters.Add(name, type, size) : command.Parameters.Add(name, type);
        param.Value = value;
    }

    private static DateTime GetUtcDateTime(SqlDataReader reader, string column) =>
        DateTime.SpecifyKind(reader.GetDateTime(reader.GetOrdinal(column)), DateTimeKind.Utc);

    public async Task<Scholar> CreateScholarAsync(Scholar scholar, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(scholar);

        const string insertScholarSql = """

                                                INSERT INTO dbo.Scholar (FirstName, LastName, BirthDate, Grade, SchoolId)
                                                OUTPUT INSERTED.ScholarId
                                                VALUES (@FirstName, @LastName, @BirthDate, @Grade, @SchoolId);
                                        """;

        const string insertScheduleSql = """

                                                 INSERT INTO dbo.ScholarPickupSchedule (ScholarId, ScheduleJson)
                                                 VALUES (@ScholarId, @ScheduleJson);
                                         """;

        const string insertParentSql = """
                                        INSERT INTO dbo.ScholarParent (ScholarId, Role, FirstName, LastName, PhoneNumber)
                                        VALUES (@ScholarId, @Role, @FirstName, @LastName, @PhoneNumber);
                                        """;

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        await using var insertScholarCmd = new SqlCommand(insertScholarSql, connection, transaction);
        AddParam(insertScholarCmd, "@FirstName", SqlDbType.NVarChar, scholar.FirstName, 100);
        AddParam(insertScholarCmd, "@LastName", SqlDbType.NVarChar, scholar.LastName ?? string.Empty, 100);
        AddParam(insertScholarCmd, "@BirthDate", SqlDbType.Date, (object?)scholar.BirthDate ?? DBNull.Value);
        AddParam(insertScholarCmd, "@Grade", SqlDbType.TinyInt, (object?)scholar.Grade ?? DBNull.Value);
        AddParam(insertScholarCmd, "@SchoolId", SqlDbType.Int, (object?)scholar.SchoolId ?? DBNull.Value);

        var insertedIdObj = await insertScholarCmd.ExecuteScalarAsync(cancellationToken);
        if (insertedIdObj is not Guid insertedId)
            throw new InvalidOperationException("Scholar was inserted, but no ID was returned.");

        scholar.ScholarId = insertedId;

        if (scholar.PickupSchedule != null)
        {
            await using var insertScheduleCmd = new SqlCommand(insertScheduleSql, connection, transaction);
            AddParam(insertScheduleCmd, "@ScholarId", SqlDbType.UniqueIdentifier, insertedId);
            AddParam(insertScheduleCmd, "@ScheduleJson", SqlDbType.NVarChar,
                JsonSerializer.Serialize(scholar.PickupSchedule, JsonOptions), -1);

            await insertScheduleCmd.ExecuteNonQueryAsync(cancellationToken);
        }

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
            AddParam(insertParentCmd, "@Role", SqlDbType.VarChar, role, 20);
            AddParam(insertParentCmd, "@FirstName", SqlDbType.NVarChar, ToDbValue(firstName), 100);
            AddParam(insertParentCmd, "@LastName", SqlDbType.NVarChar, ToDbValue(lastName), 100);
            AddParam(insertParentCmd, "@PhoneNumber", SqlDbType.VarChar, ToDbValue(phoneNumber), 15);
            await insertParentCmd.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);

        await LogAuditAsync(insertedId, AuditAction.Created);

        return scholar;
    }

    public async Task<IReadOnlyList<Scholar>> GetScholarsAsync(CancellationToken cancellationToken)
    {
        const string sql = """

                                           SELECT s.ScholarId, s.FirstName, s.LastName, s.BirthDate, s.Grade, s.SchoolId, ps.ScheduleJson,
                                                  mother.FirstName AS MotherFirstName, mother.LastName AS MotherLastName, mother.PhoneNumber AS MotherPhoneNumber,
                                                  father.FirstName AS FatherFirstName, father.LastName AS FatherLastName, father.PhoneNumber AS FatherPhoneNumber
                                           FROM dbo.Scholar AS s
                                           LEFT JOIN dbo.ScholarPickupSchedule AS ps ON s.ScholarId = ps.ScholarId
                                           LEFT JOIN dbo.ScholarParent AS mother ON mother.ScholarId = s.ScholarId AND mother.Role = 'Mother'
                                           LEFT JOIN dbo.ScholarParent AS father ON father.ScholarId = s.ScholarId AND father.Role = 'Father';
                           """;

        var scholars = new List<Scholar>();

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            scholars.Add(MapScholarFromReader(reader));
        }

        return scholars;
    }

    public async Task<Scholar?> GetScholarAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholarId));

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);

        return await ReadScholarAsync(connection, null, scholarId, cancellationToken);
    }

    private async Task<Scholar?> ReadScholarAsync(SqlConnection connection, SqlTransaction? transaction,
        Guid scholarId, CancellationToken cancellationToken)
    {
        var lockHint = transaction is null ? "" : " WITH (UPDLOCK)";
        var sql = $"""
                   SELECT s.ScholarId, s.FirstName, s.LastName, s.BirthDate, s.Grade, s.SchoolId, ps.ScheduleJson,
                          mother.FirstName AS MotherFirstName, mother.LastName AS MotherLastName, mother.PhoneNumber AS MotherPhoneNumber,
                          father.FirstName AS FatherFirstName, father.LastName AS FatherLastName, father.PhoneNumber AS FatherPhoneNumber
                   FROM dbo.Scholar AS s{lockHint}
                   LEFT JOIN dbo.ScholarPickupSchedule AS ps ON s.ScholarId = ps.ScholarId
                   LEFT JOIN dbo.ScholarParent AS mother ON mother.ScholarId = s.ScholarId AND mother.Role = 'Mother'
                   LEFT JOIN dbo.ScholarParent AS father ON father.ScholarId = s.ScholarId AND father.Role = 'Father'
                   WHERE s.ScholarId = @ScholarId;
                   """;

        await using var command = new SqlCommand(sql, connection, transaction);
        AddParam(command, "@ScholarId", SqlDbType.UniqueIdentifier, scholarId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapScholarFromReader(reader) : null;
    }

    public async Task<Scholar?> UpdateScholarAsync(Scholar scholar, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(scholar);
        if (scholar.ScholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholar));

        const string updateScholarSql = """

                                                UPDATE dbo.Scholar
                                                SET FirstName = @FirstName,
                                                    LastName = @LastName,
                                                    BirthDate = @BirthDate,
                                                    Grade = @Grade,
                                                    SchoolId = @SchoolId
                                                WHERE ScholarId = @ScholarId;
                                        """;

        const string updateScheduleSql = """

                                                 IF EXISTS (SELECT 1 FROM dbo.ScholarPickupSchedule WHERE ScholarId = @ScholarId)
                                                     UPDATE dbo.ScholarPickupSchedule
                                                     SET ScheduleJson = @ScheduleJson
                                                     WHERE ScholarId = @ScholarId
                                                 ELSE
                                                     INSERT INTO dbo.ScholarPickupSchedule (ScholarId, ScheduleJson)
                                                     VALUES (@ScholarId, @ScheduleJson);
                                         """;

        const string upsertParentSql = """
                                        IF EXISTS (SELECT 1 FROM dbo.ScholarParent WHERE ScholarId = @ScholarId AND Role = @Role)
                                            UPDATE dbo.ScholarParent
                                            SET FirstName = @FirstName, LastName = @LastName, PhoneNumber = @PhoneNumber
                                            WHERE ScholarId = @ScholarId AND Role = @Role
                                        ELSE
                                            INSERT INTO dbo.ScholarParent (ScholarId, Role, FirstName, LastName, PhoneNumber)
                                            VALUES (@ScholarId, @Role, @FirstName, @LastName, @PhoneNumber);
                                        """;

        const string deleteParentSql = "DELETE FROM dbo.ScholarParent WHERE ScholarId = @ScholarId AND Role = @Role;";

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        var before = await ReadScholarAsync(connection, transaction, scholar.ScholarId, cancellationToken);

        await using var updateScholarCmd = new SqlCommand(updateScholarSql, connection, transaction);
        AddParam(updateScholarCmd, "@ScholarId", SqlDbType.UniqueIdentifier, scholar.ScholarId);
        AddParam(updateScholarCmd, "@FirstName", SqlDbType.NVarChar, scholar.FirstName ?? string.Empty, 100);
        AddParam(updateScholarCmd, "@LastName", SqlDbType.NVarChar, scholar.LastName ?? string.Empty, 100);
        AddParam(updateScholarCmd, "@BirthDate", SqlDbType.Date, (object?)scholar.BirthDate ?? DBNull.Value);
        AddParam(updateScholarCmd, "@Grade", SqlDbType.TinyInt, (object?)scholar.Grade ?? DBNull.Value);
        AddParam(updateScholarCmd, "@SchoolId", SqlDbType.Int, (object?)scholar.SchoolId ?? DBNull.Value);

        var rowsAffected = await updateScholarCmd.ExecuteNonQueryAsync(cancellationToken);
        if (rowsAffected == 0)
            return null;

        if (scholar.PickupSchedule != null)
        {
            await using var updateScheduleCmd = new SqlCommand(updateScheduleSql, connection, transaction);
            AddParam(updateScheduleCmd, "@ScholarId", SqlDbType.UniqueIdentifier, scholar.ScholarId);
            AddParam(updateScheduleCmd, "@ScheduleJson", SqlDbType.NVarChar,
                JsonSerializer.Serialize(scholar.PickupSchedule, JsonOptions), -1);
            await updateScheduleCmd.ExecuteNonQueryAsync(cancellationToken);
        }

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
                AddParam(deleteParentCmd, "@ScholarId", SqlDbType.UniqueIdentifier, scholar.ScholarId);
                AddParam(deleteParentCmd, "@Role", SqlDbType.VarChar, role, 20);
                await deleteParentCmd.ExecuteNonQueryAsync(cancellationToken);
            }
            else
            {
                await using var upsertParentCmd = new SqlCommand(upsertParentSql, connection, transaction);
                AddParam(upsertParentCmd, "@ScholarId", SqlDbType.UniqueIdentifier, scholar.ScholarId);
                AddParam(upsertParentCmd, "@Role", SqlDbType.VarChar, role, 20);
                AddParam(upsertParentCmd, "@FirstName", SqlDbType.NVarChar, ToDbValue(firstName), 100);
                AddParam(upsertParentCmd, "@LastName", SqlDbType.NVarChar, ToDbValue(lastName), 100);
                AddParam(upsertParentCmd, "@PhoneNumber", SqlDbType.VarChar, ToDbValue(phoneNumber), 15);
                await upsertParentCmd.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        await transaction.CommitAsync(cancellationToken);

        await LogAuditAsync(scholar.ScholarId, AuditAction.Edited,
            before is null ? null : ScholarChanges.Describe(before, scholar));

        return scholar;
    }

    public async Task<bool> DeleteScholarAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholarId));

        const string deleteScholarSql = "DELETE FROM dbo.Scholar WHERE ScholarId = @ScholarId;";

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = new SqlCommand(deleteScholarSql, connection);
        AddParam(command, "@ScholarId", SqlDbType.UniqueIdentifier, scholarId);

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);

        if (rowsAffected == 0)
            return false;

        await LogAuditAsync(scholarId, AuditAction.Deleted);

        return true;
    }

    public async Task<bool> SaveAttendanceAsync(Guid scholarId, List<AttendanceRecord> attendance,
        CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholarId));

        ArgumentNullException.ThrowIfNull(attendance);

        const string upsertAttendanceSql = """
                                           SET XACT_ABORT ON;
                                           BEGIN TRANSACTION;

                                           UPDATE dbo.ScholarAttendance WITH (UPDLOCK, SERIALIZABLE)
                                           SET AttendanceJson = @AttendanceJson
                                           WHERE ScholarId = @ScholarId;

                                           IF @@ROWCOUNT = 0
                                               INSERT INTO dbo.ScholarAttendance (ScholarId, AttendanceJson)
                                               SELECT @ScholarId, @AttendanceJson
                                               WHERE EXISTS (SELECT 1 FROM dbo.Scholar WHERE ScholarId = @ScholarId);

                                           COMMIT TRANSACTION;
                                           """;

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = new SqlCommand(upsertAttendanceSql, connection);

        AddParam(command, "@ScholarId", SqlDbType.UniqueIdentifier, scholarId);
        AddParam(command, "@AttendanceJson", SqlDbType.NVarChar, JsonSerializer.Serialize(attendance, JsonOptions), -1);

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);

        if (rowsAffected == 0)
            return false;

        return true;
    }

    public async Task<IReadOnlyList<AttendanceRecord>> GetAttendanceAsync(Guid scholarId,
        CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholarId));

        const string sql = "SELECT AttendanceJson FROM dbo.ScholarAttendance WHERE ScholarId = @ScholarId;";

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        AddParam(command, "@ScholarId", SqlDbType.UniqueIdentifier, scholarId);

        var result = await command.ExecuteScalarAsync(cancellationToken);

        if (result is not string json)
            return new List<AttendanceRecord>();

        return JsonSerializer.Deserialize<List<AttendanceRecord>>(json, JsonOptions) ?? new List<AttendanceRecord>();
    }

    public async Task<IReadOnlyList<ScholarAttendance>> GetAllAttendanceAsync(
        CancellationToken cancellationToken)
    {
        const string sql = "SELECT ScholarId, AttendanceJson FROM dbo.ScholarAttendance;";

        var results = new List<ScholarAttendance>();

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            var scholarId = reader.GetGuid(reader.GetOrdinal("ScholarId"));
            var json = reader.GetString(reader.GetOrdinal("AttendanceJson"));

            var records = JsonSerializer.Deserialize<List<AttendanceRecord>>(json, JsonOptions) ?? new List<AttendanceRecord>();
            results.Add(new ScholarAttendance(scholarId, records));
        }

        return results;
    }

    public async Task<bool> DeleteAttendanceAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholarId));

        const string sql = "DELETE FROM dbo.ScholarAttendance WHERE ScholarId = @ScholarId;";

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        AddParam(command, "@ScholarId", SqlDbType.UniqueIdentifier, scholarId);

        var rows = await command.ExecuteNonQueryAsync(cancellationToken);

        return rows > 0;
    }

    private async Task LogAuditAsync(Guid scholarId, AuditAction action, string? details = null)
    {
        const string sql = """
                            INSERT INTO dbo.ScholarAuditLog (ScholarId, ActionType, Details)
                            VALUES (@ScholarId, @ActionType, @Details);
                            """;

        try
        {
            await using var connection = await _connectionFactory.OpenConnectionAsync();
            await using var command = new SqlCommand(sql, connection);

            AddParam(command, "@ScholarId", SqlDbType.UniqueIdentifier, scholarId);
            AddParam(command, "@ActionType", SqlDbType.VarChar, action.ToString(), 20);
            AddParam(command, "@Details", SqlDbType.NVarChar, ToDbValue(details), 500);

            await command.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            LogAuditWriteFailed(_logger, ex, scholarId, action);
        }
    }

    public async Task<IReadOnlyList<AuditLogEntry>> GetScholarAuditLogAsync(Guid scholarId, CancellationToken cancellationToken)
    {
        if (scholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholarId));

        const string sql = """
                            SELECT ScholarAuditLogId, ScholarId, ActionType, Details, OccurredAt
                            FROM dbo.ScholarAuditLog
                            WHERE ScholarId = @ScholarId
                            ORDER BY OccurredAt DESC, ScholarAuditLogId DESC;
                            """;

        var entries = new List<AuditLogEntry>();

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        AddParam(command, "@ScholarId", SqlDbType.UniqueIdentifier, scholarId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            entries.Add(new AuditLogEntry
            {
                ScholarAuditLogId = reader.GetInt32(reader.GetOrdinal("ScholarAuditLogId")),
                ScholarId = reader.GetGuid(reader.GetOrdinal("ScholarId")),
                ActionType = Enum.Parse<AuditAction>(reader.GetString(reader.GetOrdinal("ActionType"))),
                Details = reader.IsDBNull(reader.GetOrdinal("Details"))
                    ? null
                    : reader.GetString(reader.GetOrdinal("Details")),
                OccurredAt = GetUtcDateTime(reader, "OccurredAt"),
            });
        }

        return entries;
    }

    public async Task<PagedResponse<GlobalAuditLogEntry>> GetAllScholarAuditLogAsync(int pageNumber, int pageSize,
        CancellationToken cancellationToken)
    {
        const string countSql = "SELECT COUNT(*) FROM dbo.ScholarAuditLog;";

        const string pageSql = """
                            SELECT
                                l.ScholarAuditLogId, l.ScholarId, s.FirstName, s.LastName, l.ActionType, l.Details, l.OccurredAt
                            FROM dbo.ScholarAuditLog AS l
                            LEFT JOIN dbo.Scholar AS s ON s.ScholarId = l.ScholarId
                            ORDER BY l.OccurredAt DESC, l.ScholarAuditLogId DESC
                            OFFSET (@PageNumber - 1) * @PageSize ROWS
                            FETCH NEXT @PageSize ROWS ONLY;
                            """;

        var items = new List<GlobalAuditLogEntry>();
        int totalItems;

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);

        await using (var countCmd = new SqlCommand(countSql, connection))
        {
            totalItems = (int)(await countCmd.ExecuteScalarAsync(cancellationToken))!;
        }

        await using var pageCmd = new SqlCommand(pageSql, connection);
        AddParam(pageCmd, "@PageNumber", SqlDbType.Int, pageNumber);
        AddParam(pageCmd, "@PageSize", SqlDbType.Int, pageSize);

        await using var reader = await pageCmd.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(new GlobalAuditLogEntry
            {
                ScholarAuditLogId = reader.GetInt32(reader.GetOrdinal("ScholarAuditLogId")),
                ScholarId = reader.GetGuid(reader.GetOrdinal("ScholarId")),
                ScholarFirstName = reader.IsDBNull(reader.GetOrdinal("FirstName"))
                    ? null
                    : reader.GetString(reader.GetOrdinal("FirstName")),
                ScholarLastName = reader.IsDBNull(reader.GetOrdinal("LastName"))
                    ? null
                    : reader.GetString(reader.GetOrdinal("LastName")),
                ActionType = Enum.Parse<AuditAction>(reader.GetString(reader.GetOrdinal("ActionType"))),
                Details = reader.IsDBNull(reader.GetOrdinal("Details"))
                    ? null
                    : reader.GetString(reader.GetOrdinal("Details")),
                OccurredAt = GetUtcDateTime(reader, "OccurredAt"),
            });
        }

        return new PagedResponse<GlobalAuditLogEntry>(items, totalItems, pageNumber, pageSize);
    }

    public async Task DeleteAllScholarAuditLogAsync(CancellationToken cancellationToken)
    {
        const string sql = "DELETE FROM dbo.ScholarAuditLog;";

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static Scholar MapScholarFromReader(SqlDataReader reader)
    {
        var scholar = new Scholar
        {
            ScholarId = reader.GetGuid(reader.GetOrdinal("ScholarId")),
            FirstName = reader.GetString(reader.GetOrdinal("FirstName")),
            LastName = reader.GetString(reader.GetOrdinal("LastName")),
            BirthDate = reader.GetFieldValue<DateOnly>(reader.GetOrdinal("BirthDate")),
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
        scholar.PickupSchedule = JsonSerializer.Deserialize<PickupSchedule>(json, JsonOptions);

        return scholar;
    }

    [LoggerMessage(EventId = 2, Level = LogLevel.Error,
        Message = "Failed to write audit log entry for scholar {ScholarId}, action {Action}")]
    private static partial void LogAuditWriteFailed(ILogger logger, Exception exception, Guid scholarId,
        AuditAction action);
}
