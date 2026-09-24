# API

## What it is

The ASP.NET Core Web API (.NET 10), one project under `API/ImaloEducationApi/ImaloEducationApi/`. It serves plain HTTP and has no authentication.

## Key files / paths

- `Program.cs` — options, pipeline, CORS, OpenAPI, logging, `no-store` header.
- `Controllers/ScholarController.cs` — `ScholarsController`, route `api/scholars`.
- `Data/ScholarDataAccess.cs` (implements `IScholarDataAccess`) — all SQL.
- `Data/SqlConnectionFactory.cs` — picks the database; see below.
- `Configuration/DatabaseOptions.cs`.
- `ErrorHandling/GlobalExceptionHandler.cs`.
- `Models/`:
  - `Scholar` (with its validation attributes);
  - `PickupSchedule` (with `HourMinuteTimeOnlyConverter`);
  - `AttendanceRecord`, `ScholarAttendance`;
  - `AuditLogEntry`, `GlobalAuditLogEntry`, `AuditAction`;
  - `PagedResponse`.
- `appsettings.json` — `ConnectionStrings`, `Cors:AllowedOrigins` (UI on port 4204), logging.
- `API/ImaloEducationApi/ImaloEducationApi.Tests/` — xUnit v3 tests.

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
- **Audit log:**
  - It is written after the change commits, on its own connection, and is best-effort (a failure is only logged).
  - For `Edited` entries, `ScholarChanges.Describe` lists the changed fields.
- **JSON columns:** use one shared `JsonSerializerOptions`.
- **SQL parameters:** every `SqlParameter` has an explicit `SqlDbType` and size. `AddWithValue` is never used.
- **Naming** (as in the other two apps): every data-access method ends in `Async`, and is named after the controller action it backs (`SaveAttendanceAsync`, `GetScholarAuditLogAsync`). Collections are returned as `IReadOnlyList<T>`.

### Validation and types

- **DataAnnotations and `[ApiController]`** return `400` `ValidationProblemDetails` before the action runs.
- **Rules across fields:** attendance rules and id mismatches are added with `ModelState.AddModelError`.
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
- **`500`:** anything thrown, handled by `GlobalExceptionHandler`. It is logged once, and `detail` is included in Development only.
- There's no try/catch in the controller or data access. The one exception is the best-effort audit write.

### Logging

- Built-in `Microsoft.Extensions.Logging`.
- Console format: JSON in `appsettings.json`; `simple` in Development.
- Access log: one line per request (method, path, status, duration). `/health` is excluded.
- App logs are `[LoggerMessage]` methods with event ids shared across the three APIs:
  - 1 = unhandled exception;
  - 2 = audit write failed;
  - 3/4 = which database was chosen.

### Tests

- `Models/`:
  - validation attributes;
  - `WireFormatTests`, which pin the JSON shapes.
- `Data/`:
  - `ScholarChangesTests`;
  - `SqlConnectionFactoryTests`, with a faked probe.
- `Controllers/ScholarsControllerTests` — against a Moq `IScholarDataAccess`.
- In-memory pipeline tests with `WebApplicationFactory`:
  - `ErrorHandling/ErrorResponseTests`;
  - `Configuration/StartupValidationTests`.
- Setup: `xunit.v3.mtp-v2`, Moq and `FakeLogger`, with versions in `Directory.Packages.props`.

## Gotchas / conventions

- **No auth, on purpose.** Every endpoint is open, including `DELETE /audit-log/all`.
- **Plain HTTP only.** There's no HTTPS profile and no `UseHttpsRedirection`.
- **`Cache-Control: no-store`** is set on every response. Without it, `HttpClient`'s fetch backend served stale data.
- **`ScholarDataAccess`'s SQL has no automated tests.** It would need a real SQL Server.
- **Running tests:** `dotnet test` must run from inside the repo, so the root `global.json` selects Microsoft Testing Platform.
