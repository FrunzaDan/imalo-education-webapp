# Database

## What it is

SQL Server schema for the `ImaloEducation` database, defined as an SSDT database project (`.sqlproj`) and deployed via `sqlpackage`. No ORM, no stored procedures — the API talks to it with raw parameterized ADO.NET (`SqlCommand`), see [[api]].

## Key files / paths

- `DB/ImaloEducation/ImaloEducation.sqlproj` — project file. `DSP` is `SqlAzureV12DatabaseSchemaProvider` (targets Azure SQL / SQL Server 2019-compatible surface — chosen because local dev runs against Azure SQL Edge, which reports as SQL Server 2019 and rejects a SQL2022-targeted DACPAC).
- `DB/ImaloEducation/global.json` — pins this project's build to the .NET 8 SDK; see [[build-and-run]] for why.
- `DB/ImaloEducation/Scripts/PreDeployment/PreDeployment.sql` — creates the `ImaloEducation` database itself if it doesn't exist, then `USE`s it. Runs before every table deploy.
- `DB/ImaloEducation/Scripts/PostDeployment/PostDeployment.sql` — idempotent data fix-ups that run after every deploy. Currently: rewrites legacy attendance dates `"YYYY-MM-DDT00:00:00"` → `"YYYY-MM-DD"` (see `ScholarAttendance` below).
- `DB/ImaloEducation/Tables/*.sql` — one file per table (below).

## Tables

**`Scholar`** (`Scholar.sql`) — the root entity.
- `ScholarId UNIQUEIDENTIFIER` clustered PK, default `NEWSEQUENTIALID()` (`DF_Scholar_ScholarId`) — sequential rather than `NEWID()` so inserts append to the clustered index instead of splitting pages at random
- `FirstName`, `LastName NVARCHAR(100)` NOT NULL (NVARCHAR: Romanian diacritics)
- `BirthDate DATE` NOT NULL (API: `Scholar.DateOfBirth`, a `DateOnly`)
- `Grade TINYINT` NULL (0–12, enforced app-side; API: `byte?`)
- `SchoolId INT` NULL — **not a foreign key**, no `Schools` table exists in the DB. Schools are static frontend config (`UI/src/assets/schools.json`: id, name, color, lunchPrice, transportPrice) served by `SchoolsService`, not persisted server-side. `SchoolId` here is just an integer the frontend resolves against that static list.

**`ScholarPickupSchedule`** (`ScholarPickupSchedule.sql`) — one row per scholar, JSON blob, not normalized.
- `ScholarId UNIQUEIDENTIFIER` PK **and** FK → `Scholar.ScholarId`, `ON DELETE CASCADE`
- `ScheduleJson NVARCHAR(MAX)` NOT NULL, `CHECK (ISJSON(ScheduleJson) = 1)` — the API's typed `PickUpSchedule` class serialized as JSON: `Monday`…`Friday`, each a `"HH:mm"` string or null. Rows written before the typed class have lowercase keys (`monday`…) and may hold `""` for "no pickup"; both still read back (case-insensitive names, blank → null). Shape is enforced by the API's deserialization — see [[api]].

**`ScholarAttendance`** (`ScholarAttendance.sql`) — one row per scholar, JSON blob.
- `ScholarId UNIQUEIDENTIFIER` PK and FK → `Scholar.ScholarId`, `ON DELETE CASCADE`
- `AttendanceJson NVARCHAR(MAX)` NOT NULL, `CHECK (ISJSON(AttendanceJson) = 1)` — a `List<AttendanceRecord>` (`Date` as `"YYYY-MM-DD"`, `LunchCost`, `TransportCost`, `Present`, `LunchSelected`, `TransportSelected`) serialized as JSON. `Date` was a `DateTime` (`"…T00:00:00"`) until it became `DateOnly`; the post-deployment script rewrites any old-format date, since the `DateOnly` converter rejects a time part. A day is only present in the list if it's ever been touched in the UI; unchecking a day keeps its record with `…Selected: false` rather than removing it. `Present` gates `LunchSelected`/`TransportSelected` — the API rejects a save where either is `true` while `Present` is `false` (see [[api]]); all three default to `true` so records saved before `Present` existed still deserialize as present, matching the selections they already carried.

**`ScholarParent`** (`ScholarParent.sql`) — genuinely relational (unlike the two JSON-blob tables above), because it's a bounded one-to-few relationship, not a day-keyed collection.
- `(ScholarId, Role)` clustered PK — natural key, no surrogate `ScholarParentId` (every query addresses a parent by scholar + role). Also *is* the "at most one Mother and one Father per scholar" rule, and covers the FK.
- `ScholarId UNIQUEIDENTIFIER` NOT NULL, FK → `Scholar.ScholarId`, `ON DELETE CASCADE`
- `Role VARCHAR(6)` NOT NULL, `CHECK (Role IN ('Mother','Father'))`
- `FirstName`, `LastName NVARCHAR(100)` NULL, `PhoneNumber VARCHAR(20)` NULL (ASCII-only per the API's phone regex) — each independently optional
- `CHECK (FirstName IS NOT NULL OR LastName IS NOT NULL OR PhoneNumber IS NOT NULL)` — a row can't exist with every field empty; the API deletes the row instead once all three go blank on an edit.

**`ScholarAuditLog`** (`ScholarAuditLog.sql`) — lifecycle history (Created/Edited/Deleted) for scholars.
- `ScholarAuditLogId INT IDENTITY(1,1)` PK
- `ScholarId UNIQUEIDENTIFIER` NOT NULL — **no FK to `Scholar`**, deliberately: a deleted scholar's audit history must survive the hard delete.
- `ActionType VARCHAR(10)` NOT NULL, `CHECK (ActionType IN ('Created','Edited','Deleted'))` — the API's `AuditAction` enum, stored by name
- `Details NVARCHAR(500)` NULL
- `OccurredAt DATETIMEOFFSET(3)` NOT NULL, default `SYSUTCDATETIME()` — carries its UTC offset so it serializes as `…+00:00`. (As a bare `DATETIME2` it went out with no offset and browsers displayed UTC as local time.)
- Two non-clustered indexes: `IX_ScholarAuditLog_ScholarId` (per-scholar lookups) and `IX_ScholarAuditLog_OccurredAt_ScholarAuditLogId` on `(OccurredAt DESC, ScholarAuditLogId DESC)` (supports the global, unfiltered newest-first paged view — the ScholarId index doesn't help there since no ScholarId filter is applied).

## How it works

- Deploy path: `sqlpackage /Action:Publish` against a built `.dacpac`, with `/p:BlockOnPossibleDataLoss=false` (see [[build-and-run]]) — SSDT's default guard would otherwise block any table rebuild against a table with existing rows, which is routine on a disposable local dev DB.
- No seed data, no migrations mechanism — schema state is whatever the current `.sqlproj` tables define; `sqlpackage` diffs and republishes.
- No indexes beyond the two on `ScholarAuditLog` and the clustered PKs — table volumes are small (learning project, not production scale).
- All constraints (defaults included) are explicitly named, so `sqlpackage` diffs them by name instead of dropping/recreating system-named ones.

## Naming conventions

Applied on 2026-09-23 to all three sibling projects (customer-management-system, employee-management-system, imalo-education-webapp) so their schemas read the same way. Follow these for any new object:

- **PascalCase everywhere**: tables, columns, parameters, result-set aliases, constraints. Acronyms are written as words (`Id`, `Json`, never `ID`).
- **No type or object-kind prefixes/suffixes**: no `tbl_`, no `usp_`/`sp_`, no `_guid`.
- **Tables are singular nouns** (`Scholar`). A table owned by another starts with its owner's name: `ScholarParent`, `ScholarPickupSchedule`, `ScholarAttendance`, `ScholarAuditLog`.
- **Keys**: the primary key is `<Table>Id` (`ScholarId`, `ScholarAuditLogId`) — never a bare `Id`; a foreign-key column has exactly the name of the key it references (`ScholarParent.ScholarId`). A natural key keeps its natural name (`ScholarParent`'s `(ScholarId, Role)`).
- **Column suffixes**: `…At` = a UTC moment (`OccurredAt`); `…Date` = a calendar date (`DATE`: `BirthDate`); `…Json` = a JSON payload (`ScheduleJson`, `AttendanceJson`). Plain English over jargon/abbreviations, and no reserved words (`ActionType`, not `Action`).
- **Constraints and indexes are always named**: `PK_<Table>`, `FK_<Child>_<Parent>`, `UQ_<Table>_<Column>`, `CK_<Table>_<Column>`, `DF_<Table>_<Column>`, `IX_<Table>_<KeyColumn1>_<KeyColumn2>…`.
- **SQL in `ScholarDataAccess`**: tables are schema-qualified (`dbo.Scholar`), and every parameter is named exactly like the column it feeds or compares with (`@ScholarId`, `@BirthDate`, `@ActionType`). If stored procedures are ever introduced, name them `<Entity>_<Verb>` (`Scholar_Create`, `Scholar_Get`, `Scholar_List`, …) like the sibling projects.
- **Files**: one object per file, named after the object (`Tables/ScholarParent.sql`); deployment scripts are `Scripts/PreDeployment/PreDeployment.sql` and `Scripts/PostDeployment/PostDeployment.sql`. The database (and `.sqlproj`) is `ImaloEducation`, no `DB` suffix.
- **The API's names did not change with the DB names**: the C# model and JSON still say `id`, `dateOfBirth`, `pickUpSchedule`, `auditId`, `action`, `actionDate`; `ScholarDataAccess` is the one place the two vocabularies meet.

## Gotchas / conventions

- Don't add a `Schools` table without checking with the user first — school data being static frontend JSON (not DB-backed) is a deliberate simplification, not an oversight.
- `ScholarPickupSchedule`/`ScholarAttendance` being JSON blobs (not normalized per-day rows) means the DB itself enforces nothing about their structure beyond "valid JSON" (the `ISJSON` checks) — all shape validation happens in `Scholar.ValidatePickUpSchedule` (API) or in the Angular form before submit. See [[api]] for the validator.
- `DSP` is `SqlAzureV12DatabaseSchemaProvider`, not `Sql160DatabaseSchemaProvider` (SQL Server 2022) — required for `sqlpackage` to publish successfully against Azure SQL Edge, which identifies as SQL Server 2019. Don't bump it without confirming the target engine changed too.

## History

- **Naming pass (2026-09-23).** Renamed to the "Naming conventions" above — was `Scholars`/`Parents`/`PickUpSchedule`/`Attendance`, `Scholars.Id`, `DateOfBirth`, `ScholarAuditLog.AuditId`/`Action`/`ActionDate`, the `ImaloEducationDB` database, and a flat `DB/` folder with `Script.PreDeployment.sql`/`Script.PostDeployment.sql`. Deployed as a fresh database (the old one is left untouched on the container), not migrated in place.
