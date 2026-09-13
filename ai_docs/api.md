# API

## What it is

ASP.NET Core Web API (.NET 10, C#), single controller, plain ADO.NET data access (no ORM, no stored procedures — see [[database]]). Plain HTTP only, no HTTPS profile, no authentication.

## Key files / paths

- `ImaloEducationApi/Program.cs` — host setup: CORS, Swagger, logging middleware, `no-store` cache header.
- `ImaloEducationApi/Controllers/ScholarController.cs` — the one controller, `ScholarsController`, route `api/Scholars`.
- `ImaloEducationApi/Data/ScholarDataAccess.cs` — all SQL, scoped DI service.
- `ImaloEducationApi/Models/Scholar.cs` — the `Scholar` model + its `ValidationAttribute` validators.
- `ImaloEducationApi/Models/AttendanceRecord.cs`, `AuditLogEntry.cs` (+ `GlobalAuditLogEntry`), `PagedResult.cs` — the other DTOs/models.
- `ImaloEducationApi/Logging/AppLogger.cs` — singleton, logs a startup "ramp-up" block (env, OS, DB connectivity check, memory) once via `Program.cs`.
- `ImaloEducationApi/Logging/RequestLoggingMiddleware.cs` — logs method/path/user/IP/origin on every request, and status/duration on every response.
- `ImaloEducationApi/appsettings.json` — `ConnectionStrings:DefaultConnection`.

## Endpoints

All under `api/Scholars`. All return `500` with `{ message, details = ex.Message }` on unexpected exceptions (see Gotchas — this leaks internal exception text to the client, a known/accepted gap, not yet fixed).

**Scholars**
- `POST /api/Scholars` — create. Body: `Scholar`. `400` with per-field validation errors if `ModelState` is invalid. `201 Created` (Location header to `GetScholarById`) on success.
- `GET /api/Scholars` — list all.
- `GET /api/Scholars/{id:guid}` — one scholar. `404` if not found.
- `PUT /api/Scholars/{id:guid}` — update. `400` if the URL id and body `scholar.Id` don't match, or validation fails. `404` if no such scholar.
- `DELETE /api/Scholars/{id:guid}` — `204 No Content` on success, `404` if not found. Cascades to `PickUpSchedule`, `Attendance`, `Parents` via DB `ON DELETE CASCADE` — the controller doesn't delete children itself.

**Audit log** (`ScholarAuditLog` table — see [[database]])
- `GET /api/Scholars/{id:guid}/auditLog` — full history for one scholar, newest first.
- `GET /api/Scholars/auditLog/all?pageNumber=1&pageSize=20` — global, paginated, newest first. `pageNumber` must be ≥1, `pageSize` 1–100 (`400` otherwise). Returns `PagedResult<GlobalAuditLogEntry>` (`PageNumber`, `PageSize`, `TotalItems`, `Items`).
- `DELETE /api/Scholars/auditLog/all` — clears the entire audit log. **No confirmation, no auth** — see Gotchas.

**Attendance**
- `POST /api/Scholars/{id:guid}/attendance` — upserts (replaces) the scholar's whole `List<AttendanceRecord>` in one call — not a per-day patch.
- `GET /api/Scholars/{id:guid}/attendance` — `200` with `[]` if none exist yet (not `404` — a new scholar having no attendance is a normal state).
- `DELETE /api/Scholars/{id:guid}/attendance` — `404` if nothing to delete.
- `GET /api/Scholars/attendance` — every scholar's attendance in one call, shape `[{ scholarId, attendance: AttendanceRecord[] }]`. Backs the attendance dashboard, not the per-scholar page.

**Other**
- `GET /health` — liveness only (`AddHealthChecks()`, no DB probe), mapped directly in `Program.cs`, not part of `ScholarsController`.
- `GET /swagger` — Swagger UI, development environment only.

## How it works

- `ScholarDataAccess` is `Scoped`, injected into the controller; every method opens its own `SqlConnection` (no shared/ambient connection or unit-of-work).
- `CreateScholarAsync`/`UpdateScholarAsync` wrap the Scholar row + `PickUpSchedule` row + `Parents` row(s) in a single `SqlTransaction` — all committed or none.
- `GetScholarsAsync`/`GetScholarByIdAsync` fetch `Parents` via two `OUTER APPLY` subqueries (one per Role), not a `LEFT JOIN` — a plain join would duplicate the scholar row whenever both a Mother and Father row exist.
- Audit logging (`LogAuditAsync`) is **best-effort and out-of-band**: it always runs *after* the triggering mutation's own transaction has already committed, on its own separate connection, wrapped in its own try/catch that only logs on failure — a DB hiccup writing the audit row must never turn an otherwise-successful create/update/delete into a `500`.
- `Parents` upsert logic (both create and update): a role's row is written only if at least one of `FirstName`/`LastName`/`PhoneNumber` is non-blank; on update, a role that's gone fully blank gets its row deleted rather than left empty (enforced at the DB layer too, by `Parents`' `CHECK` constraint — see [[database]]).
- `Scholar.PickUpSchedule` validation (`ValidatePickUpSchedule`) requires each key to be one of the five lowercase weekdays and each non-null value to strictly match `HH:mm` (`DateTime.TryParseExact`) — chosen specifically over `TimeSpan.TryParse`, which would silently accept a bare number like `"12"` as a duration rather than rejecting it as an invalid clock time.
- `RequestLoggingMiddleware` sits after CORS, before `UseAuthorization()`, and logs every request/response pair with method, path, user (always "Anonymous" — no auth), IP, Origin header, status code, elapsed ms.
- A middleware in `Program.cs` sets `Cache-Control: no-store` on every response — added specifically because Angular's `HttpClient` (`withFetch()` backend) was heuristically caching bare `200 OK` responses with no cache headers, showing stale data after mutations until a hard refresh.

## Gotchas / conventions

- **No authentication/authorization.** `UseAuthorization()` is called but nothing configures `AddAuthentication`/a scheme — every endpoint, including `DELETE /api/Scholars/auditLog/all`, is open to anyone who can reach the API. Known, deliberately deferred for this learning project.
- **CORS is wide open** (`AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()`), flagged in-line with `// TODO: Restrict to specific origins in production`.
- **Exception messages leak to clients** — every catch-all `500` response includes `details = ex.Message` verbatim. Known, deliberately deferred.
- **Unit tests** — `ImaloEducationApi.Tests` (xUnit), covering `Scholar`'s validation attributes (`ValidateDateOfBirth`, `ValidatePickUpSchedule`, `ValidatePhoneNumber`) individually and through `Validator.TryValidateObject`, the same path ASP.NET Core's `ModelState` binding uses. Run via `dotnet test ImaloEducationApi.Tests` or as part of [[build-and-run]]'s `build.sh`. No controller/data-access tests yet — `ScholarDataAccess` is a concrete class with no interface, so unit-testing the controllers would need either an interface extraction or a real DB integration test; neither exists yet, don't assume controller behavior is covered.
- Direct SQL via `SqlCommand`, not stored procedures or an ORM — a deliberate simplicity choice for this project (contrast with sibling projects that route everything through stored procs).
- The API is plain HTTP (`http://localhost:5244`, see `Properties/launchSettings.json`) — no HTTPS launch profile, so none of the usual dev-cert trust issues apply here.
