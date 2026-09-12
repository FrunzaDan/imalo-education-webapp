# Known Gaps / Deliberately Deferred

## What it is

Things in this codebase that are known limitations of an early-stage learning project rather than oversights to silently "fix" — read this before assuming something is a bug.

## Key files / paths

- `ImaloEducationApi/Program.cs` — CORS policy, middleware pipeline
- `ImaloEducationApi/appsettings.json` — `ConnectionStrings:DefaultConnection`
- `ImaloEducationApi/Data/ScholarDataAccess.cs` — raw SQL, no stored procs
- `Frontend/src/app/components/attendance/`, `Frontend/src/app/components/attendance-per-scholar/` — attendance dashboard + per-scholar view
- `Frontend/src/app/components/scholar-form/` — merged create/edit scholar form
- `Frontend/src/app/app.routes.server.ts`, `Frontend/src/app/app.config.server.ts` — per-route SSR render modes
- `Frontend/src/server.ts`, `Frontend/src/main.server.ts` — the standalone Node SSR server (`serve:ssr:*` script) — see "Newly found, deliberately left open" below

## How it works (i.e., what's deferred, and why it's known)

- **No authentication/authorization.** `Program.cs` calls `app.UseAuthorization()` but nothing calls `AddAuthentication`/configures a scheme — every endpoint is open. Nothing in the app currently distinguishes users.
- **CORS is wide open** (`AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()`), flagged in-line with a `// TODO: Restrict to specific origins in production`.
- **No automated tests** for the API (no test project in the solution) or the Angular app (no `.spec.ts` files, and `angular.json` has no `test` architect target even though `package.json` still has a `"test": "ng test"` script — running it would fail).
- **Direct SQL in `ScholarDataAccess`**, not stored procedures — a deliberate simplicity choice for this project, unlike some sibling projects (e.g. Customer_Management_System) that route all data access through stored procs.
- **`PickUpSchedule`/`Attendance` are JSON blobs**, not normalized tables — fine at this data volume/shape, but means the DB can't enforce structure on schedule/attendance entries beyond "valid JSON."
- **Connection string password is a plaintext placeholder** (`MyStrongPassw0rd?`) in `appsettings.json` — fine for local dev, not meant to protect anything real.
- No ESLint config and no `lint` script, despite `.prettierrc`/`.editorconfig` being present — nothing enforces frontend consistency automatically.
- See "Newly found, deliberately left open" below for the standalone Node SSR server crash.

## Gotchas / conventions

- Don't treat this file as a TODO list to clear autonomously — several of these (no auth, open CORS, no tests, no stored procs) are appropriate for this project's current learning-project scope until the user decides otherwise.

## Resolved (kept here for history — don't rediscover these as "new" findings)

- ~~`ImaloEducationDB.sqlproj` set `DSP` to `Sql160DatabaseSchemaProvider` (SQL Server 2022), which `sqlpackage` refuses to publish to the local Azure SQL Edge container (reports as SQL Server 2019) — deployment plan generation failed outright, not a timing/retry issue~~ — fixed: `DSP` changed to `SqlAzureV12DatabaseSchemaProvider`, matching the sibling Customer_Management_System project's convention. Nothing in the current schema (Scholars/PickUpSchedule/Attendance — plain tables, PK/FK, `NEWID()`, `NVARCHAR(MAX)`) used a SQL2022-only feature, so this was a safe target-platform correction, not a schema change.
- ~~Building `ImaloEducationDB.sqlproj` failed with `MSB4019` (`NuGet.Build.Tasks.Pack.targets` not found) on this machine's .NET 10 SDKs (`10.0.100`, `10.0.300`), which don't ship that folder — only the installed `8.0.417` SDK does~~ — fixed (for this machine): `ImaloEducationDB/global.json` pins the SDK to `8.0.417` for this project only; see [[local-dev-setup]]. Not a schema/project-file compatibility issue — just an incomplete-looking local SDK install.
- ~~The navbar's "Attendance" link went to the unedited Angular CLI scaffold (`<p>attendance works!</p>`)~~ — fixed: `AttendanceComponent` is now a real dashboard (flat table of every attendance record across all scholars, resolved against scholar names via `ScholarsService`, sortable like the scholar table), backed by the existing `GET /api/Scholars/attendance` endpoint. Clicking a row navigates to that scholar's `/attendance/:id` detail view.
- ~~`AttendancePerScholarComponent` couldn't persist attendance selections, only showed days that already had a record, and its month picker was a `<select>` limited to months that already had data~~ — fixed, in two passes:
  - First pass: `AttendanceRecord` gained real `lunchSelected`/`transportSelected` boolean fields (backend model + frontend interface + the stored JSON), defaulting to `true` so pre-existing records still count as they did before. Added a Save button wired to the existing `AttendanceService.saveAttendance()`.
  - Second pass (creating new records, not just selecting existing ones): the month picker is now a native `<input type="month">` (any month, not just ones with existing data). The table always lists every **weekday** of the selected month (matching `PickUpSchedule`'s Mon–Fri convention — weekends excluded), not just days that already have a record. Checking Lunch/Transport for a day with no existing record seeds that day's cost from a new **per-school standard price** (`School.lunchPrice`/`transportPrice`, added to `schools.json` and the `School` interface) and adds it to what gets saved; a day never touched is never sent to the API at all — so "empty" days don't clutter the DB. A day that's been checked and then unchecked again stays saved with `…Selected: false` (consistent with how pre-existing deselected records already behaved) rather than being removed — a deliberate simplification, not full undo. Added a "Grand total" row under the existing Lunch/Transport totals.
- ~~The Lunch/Transport checkboxes mixed `[(ngModel)]` with a `(change)` handler that manually negated the same property, a double-mutation risk~~ — fixed: switched to `(ngModelChange)`, which fires once, after `ngModel` has already written the new value — the handler now only applies cross-field cascade logic (e.g. unchecking Lunch also unchecks Transport) instead of toggling anything itself. Also fixed: `filteredMonthAttendance` used to be a *copy* of each record (`{...record}`), so toggling a checkbox never touched `allAttendanceRecords` — switching months and back silently discarded any unsaved edit. It's now the same object references, filtered, so edits and Save both operate on the real data.
- ~~`src/assets/scholar-attendance-data.json` was unused mock data~~ — deleted.
- ~~School ID was a free-text input in `create-scholar`/`update-scholar`, disconnected from `SchoolsService`~~ — fixed: `create-scholar` and `update-scholar` were merged into one `ScholarFormComponent` (routed at both `/create-scholar` and `/scholars/update/:id`, keyed by whether a route `:id` is present), which now renders a `<select>` populated from `SchoolsService.getSchools()`. Both create and update now show the same `alert()` on failure (previously only update did) and both navigate to the saved scholar's detail page on success (previously only update did). `Scholar.schoolId`/`grade` were also corrected to `number | null` (matching the backend's `int?`), and `PickUpSchedule`'s day fields to optional/nullable (matching the backend's `Dictionary<string, string?>?`).
- ~~No `app.routes.server.ts`, so `angular.json`'s `"prerender": true` tried to prerender data-driven pages at build time and failed when the API wasn't running~~ — fixed: added `app.routes.server.ts` (`RenderMode.Server` for everything except `create-scholar`, which has no data dependency and stays `RenderMode.Prerender`), wired in via `provideServerRendering(withRoutes(...))` in `app.config.server.ts`. Verified: `ng build` and `build.sh` both complete cleanly with the API stopped, no more `getScholars failed: fetch failed`.
- ~~No wildcard route~~ — fixed: added `NotFoundComponent` at `path: '**'` in both `app.routes.ts` and `app.routes.server.ts`.
- ~~`HealthService` checked API health once at app startup, never again~~ — fixed: added `pollApiHealth()` (re-checks every 15s), used by `AppComponent`. Guarded to browser-only (`isPlatformBrowser`) — a repeating interval during SSR/prerendering keeps Angular's zone permanently "unstable," which hung the build's prerender step; this was caught by actually running `ng build` after the change, not just reading the code.
- ~~`create-scholar`/`update-scholar` duplicated their entire form definition~~ — fixed as part of the School ID merge above (one `ScholarFormComponent`).
- ~~"Edit Scholar" button carried the misleading `delete-button` CSS class~~ — removed.
- ~~`scholar-detail.component.css` had its first CSS block fully duplicated~~ — removed the dead first copy.
- ~~`scholar-table`'s sortable-table CSS was scoped to that one component, which the new attendance dashboard would have had to duplicate to look consistent~~ — moved into global `src/styles.css` as `.app-table`/`.table-header`/`.table-row`/`.table-cell`/`.sort-icon`, shared by both. Also fixed in passing: both attendance components rendered a loading `<div class="loading-message">`, but no CSS anywhere defined that class (each component's own CSS defined `.loading` instead, which the templates didn't use) — `.loading-message` is now defined globally.
- ~~`AttendanceService.getPresentDaysByScholarId()` was dead code, and `getAllScholarAttendance()` cached its result forever via `shareReplay(1)` with no invalidation~~ — removed the dead method; dropped the cache entirely now that the dashboard actually calls `getAllScholarAttendance()` and needs fresh data after edits made on the per-scholar page.

## Newly found, deliberately left open

- **The standalone Node SSR server crashes on startup.** Running `node dist/imalo-education-webapp/server/server.mjs` (the `npm run serve:ssr:ImaloEducationWebapp` script) throws `Error: Angular app engine manifest is not set...` immediately, on this machine (Angular 21.0.5, Node 24.17.0). Confirmed pre-existing and unrelated to anything changed in this session — reproduces identically with a stock, unmodified `app.config.server.ts` (plain `provideServerRendering()`, no route config). Not hit by the documented dev workflow — `run.sh` uses `npm start` (`ng serve`, a client-only dev server), never this script — so nothing above depended on it working. But it does mean the production SSR path (pre-building and then serving the SSR output directly with Node, rather than through `ng serve`) has never actually been verified working here. Left open; needs its own investigation if it's ever going to be used for a real deployment.
