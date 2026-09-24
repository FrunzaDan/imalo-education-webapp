# Database

## What it is

The `ImaloEducation` SQL Server database, as an SSDT project under `DB/ImaloEducation/`. There are no stored procedures and no seed data; the API uses inline SQL.

## Key files / paths

- `ImaloEducation.sqlproj`:
  - DSP is `SqlAzureV12DatabaseSchemaProvider`, because Azure SQL Edge reports itself as SQL Server 2019.
  - It has no pre- or post-deployment scripts.
- `Tables/` — `Scholar`, `ScholarPickupSchedule`, `ScholarAttendance`, `ScholarParent`, `ScholarAuditLog`.
- `global.json` — pins the .NET 8 SDK for this project. Keep it.

## How it works

### Tables

- **`Scholar`:**
  - `ScholarId` (`NEWSEQUENTIALID()`);
  - `FirstName`, `LastName` `NVARCHAR(100)`;
  - `BirthDate` `DATE`;
  - `Grade` `TINYINT` (nullable, with a check);
  - `SchoolId` `INT` (nullable). This is **not a FK**; schools live in `schools.json`.
- **`ScholarPickupSchedule`:**
  - one row per scholar, with `ScholarId` as the PK and a FK with `ON DELETE CASCADE`;
  - `ScheduleJson` is `NVARCHAR(MAX)` with `CHECK (ISJSON(...) = 1)`.
- **`ScholarAttendance`:** one row per scholar, with `AttendanceJson` holding a list of `AttendanceRecord`s. It cascades like the schedule.
- **`ScholarParent`:**
  - the PK is `(ScholarId, Role)`;
  - `Role` is `Mother` or `Father`;
  - `FirstName`, `LastName` and `PhoneNumber` (`VARCHAR(15)`) are each optional, but a check requires at least one;
  - it cascades on delete.
- **`ScholarAuditLog`:**
  - `ScholarAuditLogId` is an `INT IDENTITY`;
  - `ScholarId` has **no FK**, so history survives a delete;
  - `ActionType` is `Created`, `Edited` or `Deleted`;
  - `Details` is `NVARCHAR(500)`;
  - `OccurredAt` is `DATETIME2(3)` UTC;
  - there are two indexes, one per scholar and one global, both newest first.

### Deploy

- `run.sh` publishes the dacpac with `sqlpackage` and `BlockOnPossibleDataLoss=false`, because this is a disposable dev database.
- On the first publish, sqlpackage creates the database itself. There are no migrations.

### Error handling (the same rules as the siblings' procs)

- Multi-statement writes run in one transaction.
- The attendance save uses `SET XACT_ABORT ON` and `UPDLOCK, SERIALIZABLE`, then updates the row or inserts it.
- Expected outcomes are return values, and the API turns them into `404`. Unexpected errors propagate to `GlobalExceptionHandler`.

### Naming and data types (shared by all three apps)

- **Naming:**
  - PascalCase everywhere, with no prefixes.
  - Tables are singular. A child table starts with its owner's name (`ScholarParent`).
  - The primary key is `<Table>Id`.
  - Column suffixes: `…At` is a UTC `DATETIME2(3)`, `…Date` is a `DATE`, `…Json` is a JSON payload.
  - Constraints are always named: `PK_`, `FK_`, `CK_`, `DF_`, `IX_`.
- **SQL:** tables are schema-qualified (`dbo.Scholar`), and parameters are named like their columns.
- **Types:**
  - Entity keys are `UNIQUEIDENTIFIER` + `NEWSEQUENTIALID()`; log keys are `INT IDENTITY`.
  - Names are `NVARCHAR(100)`, and phone numbers are `VARCHAR(15)` (digits only).
  - JSON is `NVARCHAR(MAX)` + `ISJSON`.
  - Timestamps are written with `SYSUTCDATETIME()`.
- **Parameters:** every parameter has exactly its column's type.
- **API/UI names:** JSON and TypeScript names are the camelCase column names (`scholarId`, `birthDate`, `occurredAt`).

## Gotchas / conventions

- Don't add a `School` table without asking. Static school data is deliberate.
- The JSON columns only guarantee valid JSON. Their shape is enforced by the API's typed models.
- Don't change the DSP without confirming the target engine changed.
