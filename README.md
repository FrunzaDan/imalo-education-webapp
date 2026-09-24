# Imalo Education Webapp

A small full-stack CRUD app for tracking scholars (students), their weekly pick-up schedules, and daily attendance — a learning project built to practice a modern Angular + ASP.NET Core + SQL Server stack end to end, not a production system.

## Architecture

Three layers, talking only over HTTP — nothing shares process or memory:

```
Angular 22 UI  --HTTP-->  ASP.NET Core Web API  --ADO.NET-->  SQL Server
 (SSR, port 4200)          (.NET 10, port 5244)                (Azure SQL Edge, port 1433)
```

| Layer | Folder | Tech |
|---|---|---|
| UI | [`UI/`](UI/) | Angular 22, standalone components, zoneless + Signals, SSR via `@angular/ssr` |
| API | [`API/ImaloEducationApi/ImaloEducationApi/`](API/ImaloEducationApi/ImaloEducationApi/) | .NET 10 / ASP.NET Core Web API, C#, raw ADO.NET (no ORM, no stored procs) |
| DB | [`DB/ImaloEducation/`](DB/ImaloEducation/) | SQL Server, SSDT `.sqlproj`, deployed via `sqlpackage` |

School reference data (name, color, lunch/transport prices) is static frontend JSON (`UI/public/assets/schools.json`), not a database table — `SchoolId` on a scholar is a plain integer, not a foreign key.

## Getting started

```bash
./run.sh    # starts Docker's SQL Server container, deploys the schema, runs the API, then `ng serve` in the foreground
```

Then open `http://localhost:4200`. `Ctrl+C` stops both the API and Angular. `run.sh` is idempotent — safe to re-run.

```bash
./build.sh  # CI-style: builds the API, the DB project, and the Angular app, then runs both test suites — no services started
```

## Documentation

Full docs live in [`ai_docs/`](ai_docs/) — **start at [`ai_docs/index.md`](ai_docs/index.md)**, which links out to one doc per layer:

- [`ai_docs/angular-frontend.md`](ai_docs/angular-frontend.md) — components, services, routing, SSR
- [`ai_docs/api.md`](ai_docs/api.md) — endpoints, request/response shapes, data-access patterns
- [`ai_docs/database.md`](ai_docs/database.md) — tables, constraints, deploy mechanics
- [`ai_docs/build-and-run.md`](ai_docs/build-and-run.md) — what `build.sh`/`run.sh` actually do, and why

## Known limitations (deliberate, not bugs)

No authentication/authorization anywhere — the app runs locally only. See `ai_docs/index.md` and the per-layer docs' Gotchas sections before "fixing" this.

CORS is limited to the UI's origins (`Cors:AllowedOrigins`), and API errors are RFC 9457 Problem Details that include exception text only in Development.

Unit tests cover the API's models, controller, error responses, startup validation and connection choice, and the Angular services, utilities and main components. `ScholarDataAccess`'s SQL has no automated tests (it would need a real SQL Server) — see `ai_docs/api.md` and `ai_docs/angular-frontend.md`.
