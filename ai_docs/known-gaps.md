# Known Gaps / Deliberately Deferred

## What it is

Things in this codebase that are known limitations of an early-stage learning project rather than oversights to silently "fix" — read this before assuming something is a bug.

## Key files / paths

- `ImaloEducationApi/Program.cs` — CORS policy, middleware pipeline
- `ImaloEducationApi/appsettings.json` — `ConnectionStrings:DefaultConnection`
- `ImaloEducationApi/Data/ScholarDataAccess.cs` — raw SQL, no stored procs

## How it works (i.e., what's deferred, and why it's known)

- **No authentication/authorization.** `Program.cs` calls `app.UseAuthorization()` but nothing calls `AddAuthentication`/configures a scheme — every endpoint is open. Nothing in the app currently distinguishes users.
- **CORS is wide open** (`AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()`), flagged in-line with a `// TODO: Restrict to specific origins in production`.
- **No automated tests** for the API (no test project in the solution) or the Angular app (no `.spec.ts` files, and `angular.json` has no `test` architect target even though `package.json` still has a `"test": "ng test"` script — running it would fail).
- **Direct SQL in `ScholarDataAccess`**, not stored procedures — a deliberate simplicity choice for this project, unlike some sibling projects (e.g. Customer_Management_System) that route all data access through stored procs.
- **`PickUpSchedule`/`Attendance` are JSON blobs**, not normalized tables — fine at this data volume/shape, but means the DB can't enforce structure on schedule/attendance entries beyond "valid JSON."
- **Connection string password is a plaintext placeholder** (`MyStrongPassw0rd?`) in `appsettings.json` — fine for local dev, not meant to protect anything real.

## Gotchas / conventions

- Don't treat this file as a TODO list to clear autonomously — several of these (no auth, open CORS, no tests, no stored procs) are appropriate for this project's current learning-project scope until the user decides otherwise.

## Resolved (kept here for history — don't rediscover these as "new" findings)

- ~~`ImaloEducationDB.sqlproj` set `DSP` to `Sql160DatabaseSchemaProvider` (SQL Server 2022), which `sqlpackage` refuses to publish to the local Azure SQL Edge container (reports as SQL Server 2019) — deployment plan generation failed outright, not a timing/retry issue~~ — fixed: `DSP` changed to `SqlAzureV12DatabaseSchemaProvider`, matching the sibling Customer_Management_System project's convention. Nothing in the current schema (Scholars/PickUpSchedule/Attendance — plain tables, PK/FK, `NEWID()`, `NVARCHAR(MAX)`) used a SQL2022-only feature, so this was a safe target-platform correction, not a schema change.
- ~~Building `ImaloEducationDB.sqlproj` failed with `MSB4019` (`NuGet.Build.Tasks.Pack.targets` not found) on this machine's .NET 10 SDKs (`10.0.100`, `10.0.300`), which don't ship that folder — only the installed `8.0.417` SDK does~~ — fixed (for this machine): `ImaloEducationDB/global.json` pins the SDK to `8.0.417` for this project only; see [[local-dev-setup]]. Not a schema/project-file compatibility issue — just an incomplete-looking local SDK install.
