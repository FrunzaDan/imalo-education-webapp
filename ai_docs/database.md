# Database

## What it is

SQL Server schema for `ImaloEducationDB`, defined as an SSDT database project (`.sqlproj`) and deployed via `sqlpackage`. No ORM, no stored procedures — the API talks to it with raw parameterized ADO.NET (`SqlCommand`), see [[api]].

## Key files / paths

- `DB/ImaloEducationDB.sqlproj` — project file. `DSP` is `SqlAzureV12DatabaseSchemaProvider` (targets Azure SQL / SQL Server 2019-compatible surface — chosen because local dev runs against Azure SQL Edge, which reports as SQL Server 2019 and rejects a SQL2022-targeted DACPAC).
- `DB/global.json` — pins this project's build to the .NET 8 SDK; see [[build-and-run]] for why.
- `DB/Scripts/Pre-Deployment/Script.PreDeployment.sql` — creates the `ImaloEducationDB` database itself if it doesn't exist, then `USE`s it. Runs before every table deploy.
- `DB/Scripts/Post-Deployment/Script.PostDeployment.sql` — idempotent data fix-ups that run after every deploy. Currently: rewrites legacy attendance dates `"YYYY-MM-DDT00:00:00"` → `"YYYY-MM-DD"` (see `Attendance` below).
- `DB/Tables/*.sql` — one file per table (below).

## Tables

**`Scholars`** (`Scholars.sql`) — the root entity.
- `Id UNIQUEIDENTIFIER` clustered PK, default `NEWSEQUENTIALID()` (`DF_Scholars_Id`) — sequential rather than `NEWID()` so inserts append to the clustered index instead of splitting pages at random
- `FirstName`, `LastName NVARCHAR(100)` NOT NULL (NVARCHAR: Romanian diacritics)
- `DateOfBirth DATE` NOT NULL (API: `DateOnly`)
- `Grade TINYINT` NULL (0–12, enforced app-side; API: `byte?`)
- `SchoolId INT` NULL — **not a foreign key**, no `Schools` table exists in the DB. Schools are static frontend config (`UI/src/assets/schools.json`: id, name, color, lunchPrice, transportPrice) served by `SchoolsService`, not persisted server-side. `SchoolId` here is just an integer the frontend resolves against that static list.

**`PickUpSchedule`** (`PickUpSchedule.sql`) — one row per scholar, JSON blob, not normalized.
- `ScholarId UNIQUEIDENTIFIER` PK **and** FK → `Scholars.Id`, `ON DELETE CASCADE`
- `ScheduleJson NVARCHAR(MAX)` NOT NULL, `CHECK (ISJSON(ScheduleJson) = 1)` — the API's typed `PickUpSchedule` class serialized as JSON: `Monday`…`Friday`, each a `"HH:mm"` string or null. Rows written before the typed class have lowercase keys (`monday`…) and may hold `""` for "no pickup"; both still read back (case-insensitive names, blank → null). Shape is enforced by the API's deserialization — see [[api]].

**`Attendance`** (`Attendance.sql`) — one row per scholar, JSON blob.
- `ScholarId UNIQUEIDENTIFIER` PK and FK → `Scholars.Id`, `ON DELETE CASCADE`
- `AttendanceJson NVARCHAR(MAX)` NOT NULL, `CHECK (ISJSON(AttendanceJson) = 1)` — a `List<AttendanceRecord>` (`Date` as `"YYYY-MM-DD"`, `LunchCost`, `TransportCost`, `Present`, `LunchSelected`, `TransportSelected`) serialized as JSON. `Date` was a `DateTime` (`"…T00:00:00"`) until it became `DateOnly`; the post-deployment script rewrites any old-format date, since the `DateOnly` converter rejects a time part. A day is only present in the list if it's ever been touched in the UI; unchecking a day keeps its record with `…Selected: false` rather than removing it. `Present` gates `LunchSelected`/`TransportSelected` — the API rejects a save where either is `true` while `Present` is `false` (see [[api]]); all three default to `true` so records saved before `Present` existed still deserialize as present, matching the selections they already carried.

**`Parents`** (`Parents.sql`) — genuinely relational (unlike the two JSON-blob tables above), because it's a bounded one-to-few relationship, not a day-keyed collection.
- `(ScholarId, Role)` clustered PK — natural key, no surrogate `Id` (every query addresses a parent by scholar + role). Also *is* the "at most one Mother and one Father per scholar" rule, and covers the FK.
- `ScholarId UNIQUEIDENTIFIER` NOT NULL, FK → `Scholars.Id`, `ON DELETE CASCADE`
- `Role VARCHAR(6)` NOT NULL, `CHECK (Role IN ('Mother','Father'))`
- `FirstName`, `LastName NVARCHAR(100)` NULL, `PhoneNumber VARCHAR(20)` NULL (ASCII-only per the API's phone regex) — each independently optional
- `CHECK (FirstName IS NOT NULL OR LastName IS NOT NULL OR PhoneNumber IS NOT NULL)` — a row can't exist with every field empty; the API deletes the row instead once all three go blank on an edit.

**`ScholarAuditLog`** (`ScholarAuditLog.sql`) — lifecycle history (Created/Edited/Deleted) for scholars.
- `AuditId INT IDENTITY(1,1)` PK
- `ScholarId UNIQUEIDENTIFIER` NOT NULL — **no FK to `Scholars`**, deliberately: a deleted scholar's audit history must survive the hard delete.
- `Action VARCHAR(10)` NOT NULL, `CHECK (Action IN ('Created','Edited','Deleted'))` — the API's `AuditAction` enum, stored by name
- `Details NVARCHAR(500)` NULL
- `ActionDate DATETIMEOFFSET(3)` NOT NULL, default `SYSUTCDATETIME()` — carries its UTC offset so it serializes as `…+00:00`. (As a bare `DATETIME2` it went out with no offset and browsers displayed UTC as local time.)
- Two non-clustered indexes: `IX_ScholarAuditLog_ScholarId` (per-scholar lookups) and `IX_ScholarAuditLog_ActionDate` on `(ActionDate DESC, AuditId DESC)` (supports the global, unfiltered newest-first paged view — the ScholarId index doesn't help there since no ScholarId filter is applied).

## How it works

- Deploy path: `sqlpackage /Action:Publish` against a built `.dacpac`, with `/p:BlockOnPossibleDataLoss=false` (see [[build-and-run]]) — SSDT's default guard would otherwise block any table rebuild against a table with existing rows, which is routine on a disposable local dev DB.
- No seed data, no migrations mechanism — schema state is whatever the current `.sqlproj` tables define; `sqlpackage` diffs and republishes.
- No indexes beyond the two on `ScholarAuditLog` and the clustered PKs — table volumes are small (learning project, not production scale).
- All constraints (defaults included) are explicitly named, so `sqlpackage` diffs them by name instead of dropping/recreating system-named ones.

## Gotchas / conventions

- Don't add a `Schools` table without checking with the user first — school data being static frontend JSON (not DB-backed) is a deliberate simplification, not an oversight.
- `PickUpSchedule`/`Attendance` being JSON blobs (not normalized per-day rows) means the DB itself enforces nothing about their structure beyond "valid JSON" (the `ISJSON` checks) — all shape validation happens in `Scholar.ValidatePickUpSchedule` (API) or in the Angular form before submit. See [[api]] for the validator.
- `DSP` is `SqlAzureV12DatabaseSchemaProvider`, not `Sql160DatabaseSchemaProvider` (SQL Server 2022) — required for `sqlpackage` to publish successfully against Azure SQL Edge, which identifies as SQL Server 2019. Don't bump it without confirming the target engine changed too.
