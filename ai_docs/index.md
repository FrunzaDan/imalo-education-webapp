# Imalo Education Webapp — Index

## What it is

A learning full-stack CRUD app for tracking scholars (students), their pickup times and their daily attendance (lunch and transport).

## Key files / paths

| Layer | Folder | Tech |
|---|---|---|
| UI | `UI/` | Angular 22 (zoneless, signals, SSR) |
| API | `API/ImaloEducationApi/ImaloEducationApi/` | .NET 10 ASP.NET Core Web API, one project |
| DB | `DB/ImaloEducation/` | SQL Server, SSDT `.sqlproj` deployed with `sqlpackage` |

- `build.sh` — build and test everything; starts nothing.
- `run.sh` — start the Docker database, deploy the schema, then start the API and UI.
- `UI/public/assets/schools.json` — school reference data (name, color, prices). It is not stored in the DB.

## How it works

- **UI → API:** JSON over plain HTTP (`http://localhost:5244`). There's no login.
- **API → DB:** `ScholarsController` → `ScholarDataAccess` (parameterized inline SQL through ADO.NET; no stored procedures and no ORM).
- **Features:**
  - a dashboard;
  - scholar CRUD with parents and a weekly pickup schedule;
  - a pickup-time Gantt chart;
  - a monthly attendance grid, plus per-scholar attendance editing;
  - charts;
  - per-scholar and global audit logs;
  - CSV export;
  - a test-data generator.

## Documented Concepts

- [api](api.md) — endpoints, configuration, database connection, errors, logging, data access, tests.
- [database](database.md) — tables, JSON columns, error handling, naming and data types.
- [angular-frontend](angular-frontend.md) — config, routes, data loading, forms, feedback, styling, tests.
- [build-and-run](build-and-run.md) — Docker SQL, `build.sh`/`run.sh`, SSR build.
- [learning_approach](learning_approach.md) — how these docs are written and grown.

## Glossary

- **Scholar** — a student. The root entity.
- **School** — static client-side data keyed by `schoolId`. `Scholar.SchoolId` is not a foreign key.
- **Pickup schedule** — Monday–Friday, each an `"HH:mm"` time or null.
- **Attendance record** — one day: `present`, `lunchSelected`/`transportSelected` and their costs.

## Gotchas / conventions

- **No authentication, on purpose.** The app runs locally only. Don't add auth without asking.
- The API's shape differs from the sibling apps on purpose: one project, inline SQL, and no `ResponseModel` envelope. What is shared is the conventions: names, data types, Problem Details, logging and the database connection.
- The sibling apps are customer-management-system and employee-management-system.
