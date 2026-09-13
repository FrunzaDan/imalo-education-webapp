# Project Overview

## What it is

A small full-stack CRUD app for tracking scholars (students), their pick-up schedules, and daily attendance — a learning project built to practice the stack, not a production system.

## Key files / paths

| Layer | Folder | Tech |
|---|---|---|
| UI | `Frontend` | Angular 22 (SSR via `@angular/ssr`, Express server) |
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
│   ├── Tables/                  # Scholars, PickUpSchedule, Attendance, Parents
│   └── Scripts/Pre-Deployment/  # creates the ImaloEducationDB database if missing
└── Frontend/
    ├── src/server.ts             # standalone Node SSR server, angular.json outputMode:"server"
    └── src/app/
        ├── components/          # scholar-table, scholar-detail, scholar-form (create+edit),
        │                        # attendance (dashboard), attendance-per-scholar, gantt-chart,
        │                        # navbar, not-found, about, notification (global toast host)
        ├── services/            # scholars, attendance, schools, sorting, health, api-logger,
        │                        # csv-export, notification
        ├── utils/                # weekday-dates (shared by attendance + the About page's test-data generator)
        └── interfaces/
```

## How it works

- Three independently-runnable layers; nothing shares process or memory — they only talk over HTTP.
- Local dev DB runs as a **Docker container** (Azure SQL Edge — the only Microsoft SQL Server image with a working Apple Silicon/arm64 build), shared with other local .NET projects on this machine (same container name `sqlserver`, port `1433`). See [[local-dev-setup]].
- Data flows: Angular UI → plain HTTP → ASP.NET Core API → ADO.NET (parameterized `SqlCommand`s, direct table access — **no stored procedures**, unlike some sibling projects) → SQL Server.
- `PickUpSchedule` and `Attendance` are stored as JSON blobs (`ScheduleJson`, `AttendanceJson` columns) keyed by `ScholarId`, serialized/deserialized in `ScholarDataAccess` — not normalized relational tables.
- `Parents` is a genuinely relational table instead: up to one `Mother` row and one `Father` row per scholar (`UNIQUE (ScholarId, Role)`, `CHECK (Role IN ('Mother','Father'))`, `CHECK` that at least one of `FirstName`/`LastName`/`PhoneNumber` is non-null), `ON DELETE CASCADE` from `Scholars`. The API exposes each role as three optional fields on `Scholar` (`MotherFirstName`/`MotherLastName`/`MotherPhoneNumber`, and the `Father*` equivalents), fetched via two `OUTER APPLY` subqueries — one per role, each pulling all three columns without duplicating the scholar row (a `LEFT JOIN` would duplicate it when both parents exist; a scalar subquery could only return one column). On create/update, a role's row is upserted only if at least one of its three fields is non-blank, and deleted otherwise.
- The API is **plain HTTP only** (`http://localhost:5244`, see `Properties/launchSettings.json`) — no HTTPS profile, so none of the dev-cert/TLS-trust issues that HTTPS-based sibling projects have apply here.
- User-facing feedback goes through `NotificationService` (a signal-backed list of toasts) rendered by the single `<app-notification>` host in `app.html`, not `alert()` — every component that used to call `alert()` (scholar create/edit/delete, attendance save) now calls `notificationService.show(message, 'success' | 'error')`. Each toast self-dismisses after 3s, or can be dismissed early via its own close button.
- CSV export (scholar table, attendance dashboard, per-scholar attendance) is done entirely client-side via `CsvExportService` — it serializes whatever rows are already loaded/filtered/sorted in the component and triggers a `Blob` download; there's no export endpoint on the API, unlike sibling projects whose lists are server-paginated.

## Gotchas / conventions

- No authentication/authorization is wired up (`Program.cs` calls `UseAuthorization()` but nothing configures `AddAuthentication`) and CORS is wide open (`AllowAnyOrigin`) — see [[known-gaps]].
- No automated tests exist yet for either the API or the Angular app — `build.sh` does not run a test step (there's nothing to run).
