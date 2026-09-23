# API

## What it is

ASP.NET Core Web API (.NET 10, C#), single controller, plain ADO.NET data access (no ORM, no stored procedures — see [[database]]). Plain HTTP only, no HTTPS profile, no authentication.

## Key files / paths

- `API/ImaloEducationApi/ImaloEducationApi/Program.cs` — host setup: CORS, Swagger, logging middleware, `no-store` cache header.
- `API/ImaloEducationApi/ImaloEducationApi/Controllers/ScholarController.cs` — the one controller, `ScholarsController`, route `api/Scholars`.
- `API/ImaloEducationApi/ImaloEducationApi/Data/ScholarDataAccess.cs` — all SQL, scoped DI service. Implements `IScholarDataAccess` (`Data/IScholarDataAccess.cs`) — extracted solely to let `ScholarsController` be unit-tested against a mock (see Gotchas), not for a second implementation.
- `API/ImaloEducationApi/ImaloEducationApi/Models/Scholar.cs` — the `Scholar` model + its `ValidationAttribute` validators.
- `API/ImaloEducationApi/ImaloEducationApi/Models/PickUpSchedule.cs` — typed weekday schedule (`TimeOnly?` per day) + `HourMinuteTimeOnlyConverter` (strict `"HH:mm"` on the wire).
- `API/ImaloEducationApi/ImaloEducationApi/Models/AttendanceRecord.cs`, `ScholarAttendance.cs`, `AuditLogEntry.cs` (+ `GlobalAuditLogEntry : AuditLogEntry`), `AuditAction.cs`, `PagedResult.cs` — the other DTOs/models.

**Wire types** (JSON ↔ C# ↔ SQL): dates-without-time are `DateOnly` ↔ `"YYYY-MM-DD"` ↔ `DATE`/JSON string (`Scholar.DateOfBirth`, `AttendanceRecord.Date`); instants are `DateTimeOffset` ↔ ISO with offset ↔ `DATETIMEOFFSET` (`ActionDate`); pickup times are `TimeOnly?` ↔ `"HH:mm"`; `AuditAction` is an enum serialized by name (`JsonStringEnumConverter<AuditAction>`); money is `decimal`. Every `SqlParameter` is added with an explicit `SqlDbType` + size matching its column (no `AddWithValue`).
- `API/ImaloEducationApi/ImaloEducationApi/Logging/AppLogger.cs` — singleton, logs a startup "ramp-up" block (env, OS, DB connectivity check, memory) once via `Program.cs`.
- `API/ImaloEducationApi/ImaloEducationApi/Logging/RequestLoggingMiddleware.cs` — logs method/path/user/IP/origin on every request, and status/duration on every response.
- `API/ImaloEducationApi/ImaloEducationApi/appsettings.json` — `ConnectionStrings:DefaultConnection`.

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
- `POST /api/Scholars/{id:guid}/attendance` — upserts (replaces) the scholar's whole `List<AttendanceRecord>` in one call — not a per-day patch. `400` if the same `date` appears twice, or if any record has `Present: false` with `LunchSelected`/`TransportSelected: true` — a scholar can't have lunch/transport selected on a day they weren't present. Costs must be 0–9999.99 (`[Range]`, rejected by `[ApiController]`'s automatic `400`).
- `GET /api/Scholars/{id:guid}/attendance` — `200` with `[]` if none exist yet (not `404` — a new scholar having no attendance is a normal state).
- `DELETE /api/Scholars/{id:guid}/attendance` — `404` if nothing to delete.
- `GET /api/Scholars/attendance` — every scholar's attendance in one call, `List<ScholarAttendance>` (`[{ scholarId, attendance: AttendanceRecord[] }]`). Backs the attendance dashboard, not the per-scholar page.

**Other**
- `GET /health` — liveness only (`AddHealthChecks()`, no DB probe), mapped directly in `Program.cs`, not part of `ScholarsController`.
- `GET /swagger` — Swagger UI, development environment only.

## How it works

- `ScholarDataAccess` is `Scoped`, injected into the controller; every method opens its own `SqlConnection` (no shared/ambient connection or unit-of-work).
- `CreateScholarAsync`/`UpdateScholarAsync` wrap the Scholar row + `PickUpSchedule` row + `Parents` row(s) in a single `SqlTransaction` — all committed or none.
- `GetScholarsAsync`/`GetScholarByIdAsync` fetch `Parents` with two `LEFT JOIN`s, one per role, the role in the `ON` clause (`mother.Role = 'Mother'`). `(ScholarId, Role)` is `Parents`' primary key, so each join matches at most one row — no duplicated scholar rows — and each is a clustered-index seek.
- One `static readonly JsonSerializerOptions` (`PropertyNameCaseInsensitive`) for every stored-JSON read/write — options instances cache per-type metadata, so creating one per call (analyzer CA1869) throws that cache away.
- Audit logging (`LogAuditAsync`) is **best-effort and out-of-band**: it always runs *after* the triggering mutation's own transaction has already committed, on its own separate connection, wrapped in its own try/catch that only logs on failure — a DB hiccup writing the audit row must never turn an otherwise-successful create/update/delete into a `500`.
- `Parents` upsert logic (both create and update): a role's row is written only if at least one of `FirstName`/`LastName`/`PhoneNumber` is non-blank; on update, a role that's gone fully blank gets its row deleted rather than left empty (enforced at the DB layer too, by `Parents`' `CHECK` constraint — see [[database]]).
- `Scholar.PickUpSchedule` is the typed `PickUpSchedule` class, validated **by deserialization**, not a validator: `[JsonUnmappedMemberHandling(Disallow)]` rejects any key but the five weekdays, and `HourMinuteTimeOnlyConverter` accepts only strict `HH:mm` (`TimeOnly.TryParseExact` — not a lenient parse, which would take a bare `"12"`), reading `""`/whitespace as null. Either failure is a `400` from model binding, with the converter's message under `$.pickUpSchedule.<day>`. `TimeOnly`'s built-in `"HH:mm:ss"` format is deliberately not used — the UI and stored data are `"HH:mm"`.
- `CreateOrUpdateAttendance`'s duplicate-date and `Present`-gates-`LunchSelected`/`TransportSelected` checks are manual LINQ in the controller (cross-record/cross-field rules), while per-field rules (cost `[Range]`) are DataAnnotations on `AttendanceRecord`, enforced by `[ApiController]` before the action runs.
- `RequestLoggingMiddleware` sits after CORS, before `UseAuthorization()`, and logs every request/response pair with method, path, user (always "Anonymous" — no auth), IP, Origin header, status code, elapsed ms.
- A middleware in `Program.cs` sets `Cache-Control: no-store` on every response — added specifically because Angular's `HttpClient` (`withFetch()` backend) was heuristically caching bare `200 OK` responses with no cache headers, showing stale data after mutations until a hard refresh.

## Gotchas / conventions

- **No authentication/authorization.** `UseAuthorization()` is called but nothing configures `AddAuthentication`/a scheme — every endpoint, including `DELETE /api/Scholars/auditLog/all`, is open to anyone who can reach the API. Known, deliberately deferred for this learning project.
- **CORS is wide open** (`AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()`), flagged in-line with `// TODO: Restrict to specific origins in production`.
- **Exception messages leak to clients** — every catch-all `500` response includes `details = ex.Message` verbatim. Known, deliberately deferred.
- **Unit tests** — `API/ImaloEducationApi/ImaloEducationApi.Tests` (xUnit), two layers:
  - `Models/` — `Scholar`'s validation attributes (`ValidateDateOfBirth`, `ValidatePhoneNumber`) individually and through `Validator.TryValidateObject`, the same path ASP.NET Core's `ModelState` binding uses; `WireFormatTests` pins the JSON shapes the UI depends on (`PickUpSchedule` read/write/rejection, `DateOnly` dates, cost `[Range]`, `AuditAction` by name, `ActionDate` with `+00:00`).
  - `Controllers/ScholarsControllerTests.cs` — `ScholarsController` against a Moq mock of `IScholarDataAccess` (status codes, `ModelState`-invalid shape, not-found vs. success vs. exception branching for every endpoint). `ScholarDataAccess` was given an `IScholarDataAccess` interface (`Data/IScholarDataAccess.cs`) purely so this mock could exist — there's still no second implementation and none is planned.
  - Still **no real-DB coverage** — `ScholarDataAccess`'s own SQL (transactions, cascade deletes, the per-role `Parents` joins, best-effort audit logging) is untested; that would need an integration test against a real SQL Server, not a mock.
  - Run via `dotnet test API/ImaloEducationApi/ImaloEducationApi.Tests` or as part of [[build-and-run]]'s `build.sh`.
- Direct SQL via `SqlCommand`, not stored procedures or an ORM — a deliberate simplicity choice for this project (contrast with sibling projects that route everything through stored procs).
- The API is plain HTTP (`http://localhost:5244`, see `Properties/launchSettings.json`) — no HTTPS launch profile, so none of the usual dev-cert trust issues apply here. `Program.cs` still calls `app.UseHttpsRedirection()` though; with no HTTPS endpoint to redirect *to*, it can't do anything useful and logs `Failed to determine the https port for redirect.` (`Microsoft.AspNetCore.HttpsPolicy.HttpsRedirectionMiddleware`, warn level) on the first incoming request — confirmed by actually running the API. Harmless (every request still gets served over HTTP), but it's a leftover inconsistency worth removing rather than "fixing" by adding a real HTTPS profile, since this stack is deliberately HTTP-only/local-only.
