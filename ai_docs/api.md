# API

## What it is

ASP.NET Core Web API (.NET 10, C#), single controller, plain ADO.NET data access (no ORM, no stored procedures — see [[database]]). Plain HTTP only, no HTTPS profile, no authentication.

## Key files / paths

- `API/ImaloEducationApi/ImaloEducationApi/Program.cs` — host setup: Problem Details + exception handler, CORS, OpenAPI/Swagger UI, logging middleware, `no-store` cache header.
- `API/ImaloEducationApi/ImaloEducationApi/ErrorHandling/GlobalExceptionHandler.cs` — the one place an unhandled exception is logged and turned into a `500` (see "Error handling").
- `API/ImaloEducationApi/ImaloEducationApi/Controllers/ScholarController.cs` — the one controller, `ScholarsController`, route `api/Scholars`.
- `API/ImaloEducationApi/ImaloEducationApi/Data/ScholarDataAccess.cs` — all SQL, scoped DI service. Implements `IScholarDataAccess` (`Data/IScholarDataAccess.cs`) — extracted solely to let `ScholarsController` be unit-tested against a mock (see Gotchas), not for a second implementation.
- `API/ImaloEducationApi/ImaloEducationApi/Models/Scholar.cs` — the `Scholar` model + its `ValidationAttribute` validators.
- `API/ImaloEducationApi/ImaloEducationApi/Models/PickupSchedule.cs` — typed weekday schedule (`TimeOnly?` per day) + `HourMinuteTimeOnlyConverter` (strict `"HH:mm"` on the wire).
- `API/ImaloEducationApi/ImaloEducationApi/Models/AttendanceRecord.cs`, `ScholarAttendance.cs`, `AuditLogEntry.cs` (+ `GlobalAuditLogEntry : AuditLogEntry`), `AuditAction.cs`, `PagedResponse.cs` — the other DTOs/models.

**Wire types** (JSON ↔ C# ↔ SQL): dates-without-time are `DateOnly` ↔ `"YYYY-MM-DD"` ↔ `DATE`/JSON string (`Scholar.BirthDate`, `AttendanceRecord.Date`); instants are `DateTime` with `Kind = Utc` ↔ ISO ending in `Z` ↔ `DATETIME2(3)` holding UTC (`AuditLogEntry.OccurredAt`; `ScholarDataAccess.GetUtcDateTime` marks the value UTC when it's read, since `DATETIME2` carries no offset); pickup times are `TimeOnly?` ↔ `"HH:mm"`; `AuditAction` is an enum serialized by name (`JsonStringEnumConverter<AuditAction>`); money is `decimal`. Every `SqlParameter` is added with an explicit `SqlDbType` + size matching its column (no `AddWithValue`).
- `API/ImaloEducationApi/ImaloEducationApi/appsettings.json` — `ConnectionStrings:DefaultConnection`.

## Endpoints

All under `api/scholars`. Every error response is RFC 9457 Problem Details — see "Error handling" below for the shapes.

**Scholars**
- `POST /api/scholars` — create. Body: `Scholar`. `400` validation problem (per-field `errors`) if the body is invalid — answered by `[ApiController]` before the action runs. `201 Created` (Location header to `GetScholar`) on success.
- `GET /api/scholars` — list all.
- `GET /api/scholars/{scholarId:guid}` — one scholar. `404` problem if not found.
- `PUT /api/scholars/{scholarId:guid}` — update. `400` validation problem if the URL's `scholarId` and the body's `scholarId` don't match (`errors.ScholarId`), or validation fails. `404` problem if no such scholar.
- `DELETE /api/scholars/{scholarId:guid}` — `204 No Content` on success, `404` problem if not found. Cascades to `ScholarPickupSchedule`, `ScholarAttendance`, `ScholarParent` via DB `ON DELETE CASCADE` — the controller doesn't delete children itself.

**Audit log** (`ScholarAuditLog` table — see [[database]])
- `GET /api/scholars/{scholarId:guid}/audit-log` — full history for one scholar, newest first.
- `GET /api/scholars/audit-log/all?pageNumber=1&pageSize=20` — global, paginated, newest first (`pageSize` defaults to 20, as in the sibling apps). The total is a separate `COUNT(*)`, so it's right even for an empty page. `pageNumber` must be ≥1, `pageSize` 1–100 — `[Range]` on the query parameters, so `[ApiController]` answers `400` (`errors.pageNumber`/`errors.pageSize`) before the action runs. Returns `PagedResponse<GlobalAuditLogEntry>` (`PageNumber`, `PageSize`, `TotalItems`, `Items`).
- `DELETE /api/scholars/audit-log/all` — clears the entire audit log. **No confirmation, no auth** — see Gotchas.

**Attendance**
- `POST /api/scholars/{scholarId:guid}/attendance` — upserts (replaces) the scholar's whole `List<AttendanceRecord>` in one call — not a per-day patch. `204 No Content` on success. `400` validation problem (`errors.attendance`, one message per broken rule, naming the dates) if the same `date` appears twice, or if any record has `Present: false` with `LunchSelected`/`TransportSelected: true` — a scholar can't have lunch/transport selected on a day they weren't present. Costs must be 0–9999.99 (`[Range]`, rejected by `[ApiController]`'s automatic `400`).
- `GET /api/scholars/{scholarId:guid}/attendance` — `200` with `[]` if none exist yet (not `404` — a new scholar having no attendance is a normal state).
- `DELETE /api/scholars/{scholarId:guid}/attendance` — `204` on success, `404` problem if nothing to delete.
- `GET /api/scholars/attendance` — every scholar's attendance in one call, `List<ScholarAttendance>` (`[{ scholarId, attendance: AttendanceRecord[] }]`). Backs the attendance dashboard, not the per-scholar page.

**Other**
- `GET /health` — liveness only (`AddHealthChecks()`, no DB probe), mapped directly in `Program.cs`, not part of `ScholarsController`.
- `GET /openapi/v1.json` — the OpenAPI document from ASP.NET Core's built-in generator (`AddOpenApi`/`MapOpenApi`), and `GET /swagger` — Swagger UI showing it (`Swashbuckle.AspNetCore.SwaggerUI` only); development environment only, the same setup as the sibling apps.

## How it works

### Error handling

Every error response is **RFC 9457 Problem Details** (`Content-Type: application/problem+json`, with `type`, `title`, `status`, `traceId`, and `detail`/`errors` where there's something to say). It's the same mechanism as the sibling apps — one `IExceptionHandler`, no try/catch in controllers or data access, exception text only in Development — with Problem Details as the body because this API is plain REST (the siblings answer in their `ResponseModel` envelope).

| Situation | Status | Body | Produced by |
|---|---|---|---|
| Invalid body / DataAnnotations / out-of-range query parameter / malformed JSON | `400` | `ValidationProblemDetails` — `errors: { field: [messages] }` | `[ApiController]`, before the action runs |
| Rule the attributes can't express (attendance date rules, URL/body ID mismatch, all-zero scholar ID) | `400` | `ValidationProblemDetails` | the action: `ModelState.AddModelError` + `ValidationProblem()` |
| Scholar/attendance not found | `404` | `ProblemDetails` with a `detail` | the action: `Problem(statusCode: 404, …)` |
| Unknown route, wrong method, unsupported media type | `404`/`405`/`415` | `ProblemDetails` | `UseStatusCodePages()` |
| Anything thrown (SQL down, bad stored JSON, bug) | `500` | `ProblemDetails`; `detail` = the exception message **in Development only** | `GlobalExceptionHandler` (registered with `AddExceptionHandler`, run by `UseExceptionHandler()` first in the pipeline) — logs it once with method + path |
| Client aborted the request | `499` | none | `UseExceptionHandler` itself, not logged as an error |

- `ScholarDataAccess` doesn't catch-and-log either. The only `catch` blocks left are deliberate: roll back a failed transaction and rethrow (create/update), keep the best-effort audit write from failing a request, skip one unreadable schedule/attendance row in a list, and rewrap corrupt stored attendance JSON with the scholar's ID for the log.
- The UI reads these bodies in `UI/src/app/utils/extract-error-message.ts`: the `errors` messages, else `detail`, else `title` (see [[angular-frontend]]).
- Tests: `ErrorHandling/ErrorResponseTests.cs` runs the real pipeline in memory (`WebApplicationFactory<Program>`, data layer mocked) and pins each row of the table above.


- `ScholarDataAccess` is `Scoped`, injected into the controller; every method opens its own `SqlConnection` (no shared/ambient connection or unit-of-work).
- `CreateScholarAsync`/`UpdateScholarAsync` wrap the Scholar row + `PickupSchedule` row + `Parents` row(s) in a single `SqlTransaction` — all committed or none.
- `GetScholarsAsync`/`GetScholarAsync` fetch `Parents` with two `LEFT JOIN`s, one per role, the role in the `ON` clause (`mother.Role = 'Mother'`). `(ScholarId, Role)` is `Parents`' primary key, so each join matches at most one row — no duplicated scholar rows — and each is a clustered-index seek.
- One `static readonly JsonSerializerOptions` (`PropertyNameCaseInsensitive`) for every stored-JSON read/write — options instances cache per-type metadata, so creating one per call (analyzer CA1869) throws that cache away.
- Audit logging (`LogAuditAsync`) is **best-effort and out-of-band**: it always runs *after* the triggering mutation's own transaction has already committed, on its own separate connection, wrapped in its own try/catch that only logs on failure — a DB hiccup writing the audit row must never turn an otherwise-successful create/update/delete into a `500`. It takes no `CancellationToken`: the change is already saved, so its entry is written even if the client disconnected meanwhile (the sibling apps' `CustomerAuditLogger`/`EmployeeAuditLogger` callers do the same). `Details` follows the sibling apps too: `null` for Created/Deleted, and for Edited the changed fields (`"Updated: first name, grade"` / `"No fields changed"`), from `ScholarChanges.Describe(before, after)`. `UpdateScholarAsync` reads the stored scholar inside its transaction `WITH (UPDLOCK)` to compare against; if that read comes back empty (unreadable stored schedule) the update still runs and `Details` stays `null`.
- `Parents` upsert logic (both create and update): a role's row is written only if at least one of `FirstName`/`LastName`/`PhoneNumber` is non-blank; on update, a role that's gone fully blank gets its row deleted rather than left empty (enforced at the DB layer too, by `Parents`' `CHECK` constraint — see [[database]]).
- `Scholar.PickupSchedule` is the typed `PickupSchedule` class, validated **by deserialization**, not a validator: `[JsonUnmappedMemberHandling(Disallow)]` rejects any key but the five weekdays, and `HourMinuteTimeOnlyConverter` accepts only strict `HH:mm` (`TimeOnly.TryParseExact` — not a lenient parse, which would take a bare `"12"`), reading `""`/whitespace as null. Either failure is a `400` from model binding, with the converter's message under `$.pickupSchedule.<day>`. `TimeOnly`'s built-in `"HH:mm:ss"` format is deliberately not used — the UI and stored data are `"HH:mm"`.
- `CreateOrUpdateAttendance`'s duplicate-date and `Present`-gates-`LunchSelected`/`TransportSelected` checks are manual LINQ in the controller (cross-record/cross-field rules), while per-field rules (cost `[Range]`) are DataAnnotations on `AttendanceRecord`, enforced by `[ApiController]` before the action runs.
- Logging is ASP.NET Core's default setup (console + debug providers, levels from `appsettings.json`), with no custom logger or request-logging middleware — the same as the sibling apps.
- A middleware in `Program.cs` sets `Cache-Control: no-store` on every response — added specifically because Angular's `HttpClient` (`withFetch()` backend) was heuristically caching bare `200 OK` responses with no cache headers, showing stale data after mutations until a hard refresh.

## Gotchas / conventions

- **No authentication/authorization, on purpose** (the app runs locally only). There is no `AddAuthentication`/`UseAuthorization()` — every endpoint, including `DELETE /api/scholars/audit-log/all`, is open to anyone who can reach the API.
- **CORS allows only the Angular app's origins**, read from `Cors:AllowedOrigins` in `appsettings.json` (`http(s)://localhost:4204`), with the methods the API uses (`GET`/`POST`/`PUT`/`DELETE`) and the `Content-Type` header — the same mechanism as the sibling apps. A new UI origin (another port, a deployed host) must be added there.
- **Unit tests** — `API/ImaloEducationApi/ImaloEducationApi.Tests` (xUnit), two layers:
  - `Models/` — `Scholar`'s validation attributes (`ValidateBirthDate`, `ValidatePhoneNumber` — digits only, 9–12, the same rule as the sibling apps) individually and through `Validator.TryValidateObject`, the same path ASP.NET Core's `ModelState` binding uses; `Data/ScholarChangesTests` covers the Edited audit entry's "Updated: …" details; `WireFormatTests` pins the JSON shapes the UI depends on (`PickupSchedule` read/write/rejection, `DateOnly` dates, cost `[Range]`, `AuditAction` by name, `OccurredAt` as UTC ending in `Z`).
  - `Controllers/ScholarsControllerTests.cs` — `ScholarsController` against a Moq mock of `IScholarDataAccess` (success vs. not-found vs. the rules the controller checks itself, for every endpoint; asserts the `ProblemDetails`/`ValidationProblemDetails` it returns, and that exceptions are *not* caught there).
  - `ErrorHandling/ErrorResponseTests.cs` — the whole pipeline in memory via `WebApplicationFactory<Program>` (`Microsoft.AspNetCore.Mvc.Testing`): what a client receives for a validation failure, bad paging, malformed JSON, a missing scholar, an unknown route, and an unhandled exception (message shown in Development, hidden in Production). `ScholarDataAccess` was given an `IScholarDataAccess` interface (`Data/IScholarDataAccess.cs`) purely so this mock could exist — there's still no second implementation and none is planned.
  - Still **no real-DB coverage** — `ScholarDataAccess`'s own SQL (transactions, cascade deletes, the per-role `Parents` joins, best-effort audit logging) is untested; that would need an integration test against a real SQL Server, not a mock.
  - Run via `dotnet test API/ImaloEducationApi/ImaloEducationApi.slnx` (from inside the repo, so the root `global.json` selects Microsoft Testing Platform) or as part of [[build-and-run]]'s `build.sh`. `dotnet test --coverage` adds a coverage report.
  - Packages: `xunit.v3.mtp-v2`, `Moq`, `Microsoft.Testing.Extensions.CodeCoverage` — identical to the sibling apps; versions live in `API/ImaloEducationApi/Directory.Packages.props` (Central Package Management), shared build settings in `Directory.Build.props`. Tests use `TestContext.Current.CancellationToken`, never `CancellationToken.None`.
- Direct SQL via `SqlCommand`, not stored procedures or an ORM — a deliberate simplicity choice for this project (contrast with sibling projects that route everything through stored procs).
- The API is plain HTTP (`http://localhost:5244`, see `Properties/launchSettings.json`) — no HTTPS launch profile, so none of the usual dev-cert trust issues apply here. There is no `UseHttpsRedirection()` either: with no HTTPS endpoint it had nothing to redirect to.
