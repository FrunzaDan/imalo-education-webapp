# Imalo Education Webapp — Index

## What it is

A learning full-stack CRUD app for an afterschool program: it tracks scholars (students) and their parents, their weekly pickup times, and their daily attendance (lunch and transport, priced per school).

## Key files / paths

| Layer | Folder | Tech |
|---|---|---|
| UI | `src/UI/` | Angular 22 (zoneless, signals, Signal Forms, SSR), custom CSS |
| API | `src/API/ImaloEducationApi/` | .NET 10 ASP.NET Core Web API: Domain, BusinessLogic, DataAccess, WebAPI + tests |
| DB | `src/DB/ImaloEducation/` | SQL Server, SSDT `.sqlproj` deployed with `sqlpackage` |

- `build.sh` — build and test everything; starts nothing.
- `run.sh` — start the Docker database, deploy the schema, then start the API and UI.
- `src/API/Postman/` — Postman collection for manual API calls.
- `src/UI/public/assets/schools.json` — school reference data (name, color, prices). It is not stored in the DB.

## How it works

### Architecture

```
Browser ──► Angular dev server :4203 (SSR via Express in Node)
              │  JSON over HTTPS, no auth
              ▼
           ASP.NET Core API :7244 (WebAPI → BusinessLogic ← DataAccess; Domain models)
             ScholarsController (ModelState; DataAnnotations live on the BusinessLogic request contracts)
               → [FromServices] <Action>Handler (BusinessLogic/Features: guards, mapping, audit trail)
                 → IScholarRepository ⇐ ScholarRepository (DataAccess: parameterized inline SQL,
                   ADO.NET, typed SqlParameters)
              │  no stored procedures, no ORM
              ▼
           SQL Server (Azure SQL Edge container "sqlserver" :1433, database ImaloEducation)
```

- **No login.** The app runs on a local machine only; CORS limits browsers to the UI's origin.
- **Responses:** successes return the model directly (no envelope); errors are RFC 9457 Problem Details.
- **JSON columns:** a scholar's pickup schedule and attendance list are each one JSON column, shaped by the API's typed models.
- **Schools** live in the UI's `schools.json`, joined client-side by `schoolId`.

### A request end to end (saving a month of attendance)

1. `attendance-per-scholar` saves the month edited in its Signal Form → `AttendanceService.saveAttendance()` → `POST api/scholars/{scholarId}/attendance` with the scholar's whole attendance list.
2. `[ApiController]` validation runs, then the controller adds the cross-field rules from `AttendanceValidation` (no duplicate dates; lunch/transport only on a present day) → `400` on failure.
3. `SaveAttendanceHandler` → `ScholarRepository.SaveAttendanceAsync` updates or inserts the row in one `UPDLOCK, SERIALIZABLE` batch; an unknown scholar returns `404`.
4. The API answers `204 No Content` and the UI toasts. Attendance saves are not audit-logged; only scholar create, edit and delete are.

### Features

- a dashboard;
- scholar CRUD with parents and a weekly pickup schedule;
- a pickup-time Gantt chart;
- a monthly attendance grid, plus per-scholar attendance editing;
- charts;
- per-scholar and global audit logs;
- CSV export;
- a test-data generator.

## Documented Concepts

- [api](api.md) — endpoints, configuration, database connection, data access, validation, errors, logging, tests.
- [database](database.md) — tables, JSON columns, deploy, error handling, naming and data types.
- [angular-frontend](angular-frontend.md) — config, render modes, routes, data loading, charts, forms, feedback, styling, tests.
- [build-and-run](build-and-run.md) — Docker SQL, `build.sh`/`run.sh`, SSR build.
- [learning_approach](learning_approach.md) — how these docs are written and grown.

### Where to look

| Question | Doc → section |
|---|---|
| Add or change an endpoint | api → Endpoints, Validation and types |
| Add a column | database → Naming and data types; api → Data access |
| Why a request returned 4xx/5xx | api → Errors |
| Add a page or chart | angular-frontend → Routes, Data loading, Charts |
| Date bugs (a day off) | angular-frontend → Gotchas (Dates) |
| Something won't start | build-and-run → Gotchas |
| Code shared with the sibling apps | angular-frontend → Gotchas (shared files) |

## Glossary

- **Scholar** — a student. The root entity.
- **School** — static client-side data keyed by `schoolId`. `Scholar.SchoolId` is not a foreign key.
- **Pickup schedule** — Monday–Friday, each an `"HH:mm"` time or null.
- **Attendance record** — one day: `present`, `lunchSelected`/`transportSelected` and their costs.

## Gotchas / conventions

- **No authentication, on purpose.** The app runs locally only. Don't add auth without asking.
- The API's shape differs from the sibling apps on purpose: inline SQL and no `ResponseModel` envelope. What is shared is the conventions: names, data types, Problem Details, logging, the database connection, and a set of identical UI files.
- The sibling apps are customer-management-system and employee-management-system. Ports: customer 4204/7145, employee 4205/7146, Imalo 4203/7244; all three share the `sqlserver` container.
