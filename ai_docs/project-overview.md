# Project Overview

## What it is

A small full-stack CRUD app for tracking scholars (students), their pick-up schedules, and daily attendance — a learning project built to practice the stack, not a production system.

## Key files / paths

| Layer | Folder | Tech |
|---|---|---|
| UI | `Frontend` | Angular 21 (SSR via `@angular/ssr`, Express server) |
| API | `ImaloEducationApi` | .NET 10 / ASP.NET Core Web API, C# |
| DB | `ImaloEducationDB` | SQL Server (SSDT `.sqlproj`, deployed via `sqlpackage`) |

```
ImaloEducationWebapp/
├── build.sh                     # restore + build .NET, DB project, Angular (no tests exist yet)
├── run.sh                       # start Docker DB, deploy schema, start API + Angular dev server
├── ImaloEducationApi/
│   ├── Program.cs               # host setup: CORS, Swagger, logging middleware
│   ├── Controllers/             # ScholarsController — scholars + attendance endpoints
│   ├── Data/                    # ScholarDataAccess — raw ADO.NET/SqlClient, no ORM, no stored procs
│   ├── Models/                  # Scholar, AttendanceRecord
│   ├── Logging/                 # AppLogger (startup log), RequestLoggingMiddleware
│   └── appsettings.json         # DefaultConnection connection string
├── ImaloEducationDB/
│   ├── global.json               # pins the .NET 8 SDK for this project — see [[local-dev-setup]]
│   ├── Tables/                  # Scholars, PickUpSchedule, Attendance
│   └── Scripts/Pre-Deployment/  # creates the ImaloEducationDB database if missing
└── Frontend/
    └── src/app/
        ├── components/          # scholar-table, scholar-detail, create-scholar, update-scholar,
        │                        # attendance, attendance-per-scholar, gantt-chart, navbar
        ├── services/            # scholars.service, attendance.service, health.service
        └── interfaces/
```

## How it works

- Three independently-runnable layers; nothing shares process or memory — they only talk over HTTP.
- Local dev DB runs as a **Docker container** (Azure SQL Edge — the only Microsoft SQL Server image with a working Apple Silicon/arm64 build), shared with other local .NET projects on this machine (same container name `sqlserver`, port `1433`). See [[local-dev-setup]].
- Data flows: Angular UI → plain HTTP → ASP.NET Core API → ADO.NET (parameterized `SqlCommand`s, direct table access — **no stored procedures**, unlike some sibling projects) → SQL Server.
- `PickUpSchedule` and `Attendance` are stored as JSON blobs (`ScheduleJson`, `AttendanceJson` columns) keyed by `ScholarId`, serialized/deserialized in `ScholarDataAccess` — not normalized relational tables.
- The API is **plain HTTP only** (`http://localhost:5244`, see `Properties/launchSettings.json`) — no HTTPS profile, so none of the dev-cert/TLS-trust issues that HTTPS-based sibling projects have apply here.

## Gotchas / conventions

- No authentication/authorization is wired up (`Program.cs` calls `UseAuthorization()` but nothing configures `AddAuthentication`) and CORS is wide open (`AllowAnyOrigin`) — see [[known-gaps]].
- No automated tests exist yet for either the API or the Angular app — `build.sh` does not run a test step (there's nothing to run).
