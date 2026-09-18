# Database

## What it is

SQL Server schema for `ImaloEducationDB`, defined as an SSDT database project (`.sqlproj`) and deployed via `sqlpackage`. No ORM, no stored procedures — the API talks to it with raw parameterized ADO.NET (`SqlCommand`), see [[api]].

## Key files / paths

- `DB/ImaloEducationDB.sqlproj` — project file. `DSP` is `SqlAzureV12DatabaseSchemaProvider` (targets Azure SQL / SQL Server 2019-compatible surface — chosen because local dev runs against Azure SQL Edge, which reports as SQL Server 2019 and rejects a SQL2022-targeted DACPAC).
- `DB/global.json` — pins this project's build to the .NET 8 SDK; see [[build-and-run]] for why.
- `DB/Scripts/Pre-Deployment/Script.PreDeployment.sql` — creates the `ImaloEducationDB` database itself if it doesn't exist, then `USE`s it. Runs before every table deploy.
- `DB/Tables/*.sql` — one file per table (below).

## Tables

**`Scholars`** (`Scholars.sql`) — the root entity.
- `Id UNIQUEIDENTIFIER` PK, default `NEWID()`
- `FirstName`, `LastName NVARCHAR(100)` NOT NULL
- `DateOfBirth DATETIME2` NOT NULL
- `Grade INT` NULL (0–12, enforced app-side)
- `SchoolId INT` NULL — **not a foreign key**, no `Schools` table exists in the DB. Schools are static frontend config (`UI/src/assets/schools.json`: id, name, color, lunchPrice, transportPrice) served by `SchoolsService`, not persisted server-side. `SchoolId` here is just an integer the frontend resolves against that static list.

**`PickUpSchedule`** (`PickUpSchedule.sql`) — one row per scholar, JSON blob, not normalized.
- `ScholarId UNIQUEIDENTIFIER` PK **and** FK → `Scholars.Id`, `ON DELETE CASCADE`
- `ScheduleJson NVARCHAR(MAX)` NOT NULL — a `Dictionary<string, string?>` serialized as JSON, keyed by lowercase weekday name (`monday`…`friday`), value a `"HH:mm"` time string or null. Validated app-side (`Scholar.ValidatePickUpSchedule`) before it ever reaches the DB — only the five weekday keys are accepted, and any non-null value must match strict 24-hour `HH:mm` (not `TimeSpan.TryParse`, which would silently accept a bare number like `"12"` as a day count).

**`Attendance`** (`Attendance.sql`) — one row per scholar, JSON blob.
- `ScholarId UNIQUEIDENTIFIER` PK and FK → `Scholars.Id`, `ON DELETE CASCADE`
- `AttendanceJson NVARCHAR(MAX)` NOT NULL — a `List<AttendanceRecord>` (`Date`, `LunchCost`, `TransportCost`, `Present`, `LunchSelected`, `TransportSelected`) serialized as JSON. A day is only present in the list if it's ever been touched in the UI; unchecking a day keeps its record with `…Selected: false` rather than removing it. `Present` gates `LunchSelected`/`TransportSelected` — the API rejects a save where either is `true` while `Present` is `false` (see [[api]]); all three default to `true` so records saved before `Present` existed still deserialize as present, matching the selections they already carried.

**`Parents`** (`Parents.sql`) — genuinely relational (unlike the two JSON-blob tables above), because it's a bounded one-to-few relationship, not a day-keyed collection.
- `Id UNIQUEIDENTIFIER` PK, default `NEWID()`
- `ScholarId UNIQUEIDENTIFIER` NOT NULL, FK → `Scholars.Id`, `ON DELETE CASCADE`
- `Role NVARCHAR(10)` NOT NULL, `CHECK (Role IN ('Mother','Father'))`
- `FirstName`, `LastName NVARCHAR(100)` NULL, `PhoneNumber NVARCHAR(20)` NULL — each independently optional
- `UNIQUE (ScholarId, Role)` — at most one Mother row and one Father row per scholar
- `CHECK (FirstName IS NOT NULL OR LastName IS NOT NULL OR PhoneNumber IS NOT NULL)` — a row can't exist with every field empty; the API deletes the row instead once all three go blank on an edit.

**`ScholarAuditLog`** (`ScholarAuditLog.sql`) — lifecycle history (Created/Edited/Deleted) for scholars.
- `AuditId INT IDENTITY(1,1)` PK
- `ScholarId UNIQUEIDENTIFIER` NOT NULL — **no FK to `Scholars`**, deliberately: a deleted scholar's audit history must survive the hard delete.
- `Action NVARCHAR(50)` NOT NULL, `Details NVARCHAR(500)` NULL, `ActionDate DATETIME2` NOT NULL
- Two non-clustered indexes: `IX_ScholarAuditLog_ScholarId` (per-scholar lookups) and `IX_ScholarAuditLog_ActionDate` on `(ActionDate DESC, AuditId DESC)` (supports the global, unfiltered newest-first paged view — the ScholarId index doesn't help there since no ScholarId filter is applied).

## How it works

- Deploy path: `sqlpackage /Action:Publish` against a built `.dacpac`, with `/p:BlockOnPossibleDataLoss=false` (see [[build-and-run]]) — SSDT's default guard would otherwise block any table rebuild against a table with existing rows, which is routine on a disposable local dev DB.
- No seed data, no migrations mechanism — schema state is whatever the current `.sqlproj` tables define; `sqlpackage` diffs and republishes.
- No indexes beyond the two on `ScholarAuditLog` and the clustered PKs — table volumes are small (learning project, not production scale).

## Gotchas / conventions

- Don't add a `Schools` table without checking with the user first — school data being static frontend JSON (not DB-backed) is a deliberate simplification, not an oversight.
- `PickUpSchedule`/`Attendance` being JSON blobs (not normalized per-day rows) means the DB itself enforces nothing about their structure beyond "valid JSON" — all shape validation happens in `Scholar.ValidatePickUpSchedule` (API) or in the Angular form before submit. See [[api]] for the validator.
- `DSP` is `SqlAzureV12DatabaseSchemaProvider`, not `Sql160DatabaseSchemaProvider` (SQL Server 2022) — required for `sqlpackage` to publish successfully against Azure SQL Edge, which identifies as SQL Server 2019. Don't bump it without confirming the target engine changed too.
