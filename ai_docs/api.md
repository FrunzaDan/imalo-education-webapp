# API

## What it is

The ASP.NET Core Web API (.NET 10), in `src/API/ImaloEducationApi/` (solution `ImaloEducation.slnx`). It serves HTTPS and has no authentication.

It is split into four projects with references pointing inward: Domain ← BusinessLogic ← DataAccess, and WebAPI → BusinessLogic (+ DataAccess for composition in `Program.cs` only).

| Project | Holds | References |
|---|---|---|
| `ImaloEducation.Domain` | Plain models (no validation attributes) | none |
| `ImaloEducation.BusinessLogic` | Handlers in `Features/`, request contracts in `Contracts/`, the `IScholarRepository` abstraction, `ScholarChanges`, `AttendanceValidation`, `AddBusinessLogic()` | Domain |
| `ImaloEducation.DataAccess` | `ScholarRepository` (all SQL), `SqlConnectionFactory`, `DatabaseOptions`, `AddDataAccess()` | BusinessLogic only |
| `ImaloEducation.WebAPI` | `Program.cs`, controller, error handling, routing | BusinessLogic, DataAccess |

## Key files / paths

- `ImaloEducation.WebAPI/`:
  - `Program.cs` — options, `AddBusinessLogic()` + `AddDataAccess()`, pipeline, CORS, OpenAPI, logging, `no-store` header.
  - `Controllers/ScholarsController.cs` — `ScholarsController`, route `api/scholars`; each action takes its handler with `[FromServices]`.
  - `ErrorHandling/GlobalExceptionHandler.cs`.
  - `Routing/KebabCaseParameterTransformer.cs` — kebab-case `[controller]` routes, as in the sibling apps.
  - `appsettings.json` — `ConnectionStrings`, `Cors:AllowedOrigins` (UI on port 4203), logging.
- `ImaloEducation.BusinessLogic/`:
  - `Features/` — one `<Action>Handler` per endpoint, each with a single `HandleAsync`:
    - `Scholars/` — create, get list, get, update, delete; plus `ScholarChanges`;
    - `Attendance/` — save, get, get all, delete;
    - `AuditLog/` — `IScholarAuditLogger`/`ScholarAuditLogger` (the best-effort audit write) and the get, get-all and delete-all handlers.
  - `Contracts/` — `ScholarRequest` and `AttendanceRecordRequest` (the request bodies, with the DataAnnotations; `ToScholar()`/`ToAttendanceRecord()` map them to Domain models), `PagedResponse`.
  - `Abstractions/IScholarRepository.cs` — the persistence port DataAccess implements.
  - `Validations/AttendanceValidation.cs`, `Validations/ScholarIdGuard.cs` (empty-id guard).
- `ImaloEducation.DataAccess/`:
  - `Repositories/ScholarRepository.cs` (implements `IScholarRepository`) — all SQL.
  - `DBConnection/SqlConnectionFactory.cs` — picks the database; see below.
  - `Configuration/DatabaseOptions.cs`.
- `ImaloEducation.Domain/Models/`:
  - `Scholar` (the response shape), `Gender`;
  - `PickupSchedule` (with `HourMinuteTimeOnlyConverter`);
  - `AttendanceRecord`, `ScholarAttendance`;
  - `AuditLogEntry` and `GlobalAuditLogEntry` (both in `AuditLogEntry.cs`), `AuditAction`.
- `src/API/ImaloEducationApi/ImaloEducation.Tests/` — xUnit v3 tests.

## How it works

### Endpoints (`/api/scholars`)

- **Scholars:**
  - `POST /` returns `201`.
  - `GET /` lists all scholars.
  - `GET /{scholarId}` returns `404` if not found.
  - `PUT /{scholarId}` returns `400` if the URL and body ids differ.
  - `DELETE /{scholarId}` returns `204`. The DB cascades to the schedule, attendance and parents.
- **Audit log:**
  - `GET /{scholarId}/audit-log`;
  - `GET /audit-log/all?pageNumber=&pageSize=` (paged; pageSize 1–100, default 20);
  - `DELETE /audit-log/all`.
- **Attendance:**
  - `GET /attendance` returns every scholar's attendance.
  - `GET /{scholarId}/attendance` returns `[]` if there's none.
  - `POST /{scholarId}/attendance` replaces the whole list. It returns `400` for a duplicate date, or for lunch/transport selected on a day marked not present.
  - `DELETE /{scholarId}/attendance`.
- **Other:**
  - `GET /health` (liveness only);
  - `/openapi/v1.json` and `/swagger`, Development only.
- **Responses:** successes return the model directly. There's no envelope.

### Configuration (options pattern)

- `ConnectionStrings` → `DatabaseOptions` (`Docker` required, `LocalSqlServer` optional).
- Registered with `AddOptions<T>().BindConfiguration(...).ValidateDataAnnotations().ValidateOnStart()`.
- A missing Docker string stops startup with an `OptionsValidationException`.

### Database connection

- `SqlConnectionFactory` picks a connection string once per process, on first use:
  - **macOS/Linux:** always `ConnectionStrings:Docker`, the Azure SQL Edge container. SQL Server has no macOS build.
  - **Windows:** it tries Docker with a 3-second probe, then falls back to `ConnectionStrings:LocalSqlServer` (Windows auth).
- The choice is logged as event 3 (Docker) or event 4 (the local fallback, a warning).
- `run.sh` passes `ConnectionStrings__Docker` for the container it started.
- Each call opens its own connection and disposes it. SqlClient pools the physical connections.

### Data access

- **Create/update:** write the scholar, schedule and parents in one `SqlTransaction`. Disposing an uncommitted transaction rolls it back.
- **Parents:** there is at most one mother and one father. A role row is written only if one of its fields is set, and deleted once all its fields are blank.
- **Attendance save:** one batch using `UPDLOCK, SERIALIZABLE`, which updates the row or inserts it. It is race-free, and an unknown scholar returns `404`.
- **Update:** `ScholarRepository.UpdateScholarAsync` reads the current row under `UPDLOCK` in the same transaction and returns it, so `UpdateScholarHandler` can describe what changed.
- **Audit log:**
  - The create, update and delete handlers write it through `IScholarAuditLogger` → `IScholarRepository.AddAuditEntryAsync` after the change commits, on its own connection, not cancelled with the request, and best-effort (a failure is only logged).
  - For `Edited` entries, `ScholarChanges.Describe` lists the changed fields.
- **JSON columns:** use one shared `JsonSerializerOptions`.
- **SQL parameters:** every `SqlParameter` has an explicit `SqlDbType` and size. `AddWithValue` is never used.
- **Naming** (as in the other two apps): handlers are named `<Action>Handler` after the controller action they back (`SaveAttendanceHandler`, `GetScholarAuditLogHandler`) and expose `HandleAsync`; repository methods end in `Async` and carry the action's name (`SaveAttendanceAsync`). Register new handlers in `BusinessLogicDependencyInjection`. Collections are returned as `IReadOnlyList<T>`.

### Validation and types

- **DataAnnotations** on `ScholarRequest` and `AttendanceRecordRequest`, checked by `[ApiController]`, return `400` `ValidationProblemDetails` before the action runs.
- **Rules across fields:** `AttendanceValidation.Validate` (BusinessLogic) returns the attendance rule violations; the controller adds them, and id mismatches, with `ModelState.AddModelError`.
- **`PickupSchedule`:**
  - it only accepts the five weekday keys;
  - times must be strict `"HH:mm"`;
  - a blank time means null.
- **Types:**
  - `DateOnly` ↔ `"YYYY-MM-DD"`;
  - UTC `DateTime` ↔ ISO with a trailing `Z`;
  - `AuditAction` serializes by name;
  - money is `decimal`.

### Errors (RFC 9457 Problem Details)

- **`400`:** validation.
- **`404`:** `Problem(statusCode: 404, detail: …)`.
- **`404`/`405`/`415` from routing:** `UseStatusCodePages`.
- **`500`:** anything thrown, handled by `GlobalExceptionHandler`. It is logged once, and `detail` is included in Development only. If the client has already aborted the request (a cancelled navigation or a superseded search), the handler logs at Debug and ends with `499` instead.
- There's no try/catch in the controller, handlers or repository. The one exception is the best-effort audit write in `ScholarAuditLogger`.

### Logging

- Built-in `Microsoft.Extensions.Logging`.
- Console format: JSON in `appsettings.json`; `simple` in Development.
- Access log: one line per request (method, path, status, duration). `/health` is excluded.
- App logs are `[LoggerMessage]` methods with event ids shared across the three APIs:
  - 1 = unhandled exception;
  - 2 = audit write failed;
  - 3/4 = which database was chosen;
  - 5 = the client aborted the request (Debug).

### Tests

- `Contracts/` — the request validation attributes (`ScholarRequestValidationTests`, `ScholarRequestRuleTests`).
- `Models/WireFormatTests`, which pin the JSON shapes.
- `Features/Scholars/ScholarChangesTests`.
- `DataAccess/SqlConnectionFactoryTests`, with a faked probe.
- `Features/Scholars/ScholarHandlersTests` — audit entries and empty-id guards, against a Moq `IScholarRepository`.
- `Architecture/LayerDependencyTests` — NetArchTest: Domain references no other layer, ASP.NET Core or SqlClient; BusinessLogic references neither DataAccess, WebAPI, ASP.NET Core nor SqlClient; DataAccess references neither WebAPI nor ASP.NET Core; the controller references neither DataAccess nor SqlClient.
- `Controllers/ScholarsControllerTests` — real handlers over a Moq `IScholarRepository`.
- In-memory pipeline tests with `WebApplicationFactory`:
  - `ErrorHandling/ErrorResponseTests` and `GlobalExceptionHandlerTests`;
  - `Configuration/StartupValidationTests`;
  - `Endpoints/ScholarEndpointTests`: every endpoint called the way the UI calls it, with only `IScholarRepository` (the SQL layer) replaced by a Moq. It checks routes, status codes (201 with `Location`, 204, 404), the JSON wire format (`HH:mm` pickup times, dates, gender as a number) and model validation.
- Setup: `xunit.v3.mtp-v2`, Moq, NetArchTest and `FakeLogger`, with versions in `Directory.Packages.props`.

## Gotchas / conventions

- **No auth, on purpose.** Every endpoint is open, including `DELETE /audit-log/all`.
- **HTTPS only.** The dev profile serves `https://localhost:7244`; outside Development the API also sends HSTS. `UseHttpsRedirection` redirects plain HTTP.
- **`Cache-Control: no-store`** is set on every response. Without it, `HttpClient`'s fetch backend served stale data.
- **`ScholarRepository`'s SQL has no automated tests.** It would need a real SQL Server.
- **Running tests:** `dotnet test` must run from inside the repo, so the root `global.json` selects Microsoft Testing Platform.
