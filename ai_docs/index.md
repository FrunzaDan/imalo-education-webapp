
> **Read this file first**, per `learning_approach.md` and `CLAUDE.md`. It orients and links out; it does not itself contain the details — each concept lives in its own file so it can be taught, corrected, and updated independently.

## What this is

A small full-stack CRUD app for tracking scholars (students), their pick-up schedules, and daily attendance — a learning project built to practice the stack, not a production system.

| Layer | Folder | Tech | Doc |
|---|---|---|---|
| UI | `UI` | Angular 22 (SSR via `@angular/ssr`, Express server) | [angular-frontend](angular-frontend.md) |
| API | `API/ImaloEducationApi/ImaloEducationApi` | .NET 10 / ASP.NET Core Web API, C# | [api](api.md) |
| DB | `DB` | SQL Server (SSDT `.sqlproj`, deployed via `sqlpackage`) | [database](database.md) |
| Build/run | repo root | `build.sh`, `run.sh`, Docker | [build-and-run](build-and-run.md) |

The three layers only talk over HTTP — nothing shares process or memory. Angular UI → ASP.NET Core API (parameterized ADO.NET, no ORM, no stored procs) → SQL Server. School reference data (name/color/prices) is static frontend JSON, not a DB table — see [angular-frontend](angular-frontend.md) and [database](database.md).

## Start here

1. This file, for orientation.
2. The relevant doc above, before exploring source directly.

## Known limitations (deliberate, not bugs)

No authentication/authorization anywhere; CORS is wide open; API error responses leak exception text. Each doc above notes these again in its own Gotchas section where relevant — don't "fix" them without checking with the user first.

Unit tests exist for both layers' pure business logic, plus `ScholarsController` (against a mocked `IScholarDataAccess`), a handful of pure Angular services, and two `TestBed` component specs (`AttendancePerScholarComponent`, `ScholarFormComponent`) (`API/ImaloEducationApi/ImaloEducationApi.Tests`, `UI/**/*.spec.ts`, run via `build.sh` — see [[build-and-run]]). Still no coverage for `ScholarDataAccess`'s actual SQL, the other 10 Angular components, or the remaining `HttpClient`-backed Angular services — see each doc's Gotchas section.
