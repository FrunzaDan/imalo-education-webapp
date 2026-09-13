# Angular Frontend

## What it is

Angular 22 standalone-component app, zoneless change detection, SSR via `@angular/ssr` + a standalone Node/Express server. Talks to `ImaloEducationApi` (see [[api]]) over plain HTTP for everything except school data, which is a static local JSON asset.

## Key files / paths

- `src/app/app.ts` / `app.config.ts` / `app.config.server.ts` — bootstrap (below).
- `src/app/app.routes.ts` / `app.routes.server.ts` — client routing (lazy-loaded) and SSR render-mode-per-route.
- `src/app/components/` — one folder per component (below).
- `src/app/services/` — one file per service (below).
- `src/app/interfaces/` — DTO shapes, mirror the API's C# models.
- `src/app/constants/week-days.ts`, `src/app/utils/weekday-dates.ts` — shared weekday helpers.
- `src/assets/schools.json` — static school reference data (id, name, color, lunchPrice, transportPrice) — **not** in the DB, see [[database]].
- `src/environments/environment.ts` — `baseUrlScholars`, `healthUrl`.
- See [[build-and-run]] for `ng serve`/`ng build`/SSR server details.

## App bootstrap

- `app.config.ts`: `provideZonelessChangeDetection()`, `provideRouter(routes)`, `provideClientHydration(withEventReplay(), withNoIncrementalHydration())`, `provideHttpClient(withFetch(), withInterceptors([apiLoggerInterceptor]))`.
- `app.config.server.ts`: merges the above with `provideServerRendering(withRoutes(serverRoutes))` for SSR.
- `app.ts` (`App`, selector `app-root`): hosts `NavbarComponent`, `NotificationComponent`, `RouterOutlet`. `apiAvailable` signal, updated by subscribing to `HealthService.pollApiHealth()` — **browser-only** (`isPlatformBrowser` guard; a repeating interval during SSR/prerendering keeps Angular's zone permanently "unstable" and hangs the build).
- `app.routes.ts`: all 11 routes use `loadComponent: () => import(...).then(m => m.XComponent)` — lazy, route-level code splitting (each route component ships as its own build chunk).
- `app.routes.server.ts`: `create-scholar` and `about` are `RenderMode.Prerender` (no data dependency on load); everything else (`**`) is `RenderMode.Server` (renders per-request — these depend on live API data the build machine may not have).

## Components

**ScholarTableComponent** (`scholar-table/`, routes `''` and `scholars`) — the scholar list/landing page.
- `scholarData = signal<TransformedScholarData[]>([])` — loaded via `forkJoin({scholars, schools})`, joined client-side (school name/color resolved per scholar; `getTextColor()` picks black/white text by relative luminance of the school color).
- `displayedScholarData` getter — filters `scholarData()` by `searchTerm` (client-side substring match on name; dataset is small enough that server-side search/pagination, used by e.g. Customer_Management_System, isn't worth the round-trip here).
- `selectedIds = signal<Set<string>>`, `toggleSelection`/`toggleSelectAll`/`allSelected` (scoped to the currently-filtered rows) back a bulk-delete flow: `bulkDeleteSelected()` confirms, then deletes each selected id via `ScholarsService.deleteScholar` with `concatMap` (sequential, not parallel), reports success/fail counts via `NotificationService`, reloads.
- `sortData(column, type)` delegates to `SortingService`. `exportCsv()` exports the currently visible/sorted rows via `CsvExportService`.

**GanttChartComponent** (`gantt-chart/`, route `pickup-time`) — see the existing in-depth notes in this file's history/session context: renders a days × scholars × time-slots grid of pickup times, color-coded per school. `scholars = signal<Scholar[]>([])`; a `computed()` map (`cellsByKey`) precomputes each occupied cell's style/label once per `scholars()` change rather than recomputing per template call (`getSlotStyle`/`getTimeRange`/`isTimeOccupied` are now O(1) lookups into that map). Time slots generated 11:00–14:00 in 15-min increments.

**AttendanceComponent** (`attendance/`, route `attendance`) — flat dashboard across every scholar.
- `rows = signal<AttendanceRow[]>([])`, loaded via `forkJoin({scholars, allAttendance: AttendanceService.getAllScholarAttendance()})`, flattened into one row per (scholar, date).
- Sortable via `SortingService` (scholarName/date/lunchCost/transportCost, ↑↓ indicators). Each row links to `/attendance/:id`. `exportCsv()` via `CsvExportService`.

**AttendancePerScholarComponent** (`attendance-per-scholar/`, route `attendance/:id`) — one scholar's monthly attendance, editable.
- Loads scholar, its school (for `lunchPrice`/`transportPrice` defaults), and attendance via `AttendanceService.getAttendanceByScholarId`.
- `selectedMonth` (`<input type="month">`, any month, not just ones with data) drives `dayRows` — one row per **weekday** of that month (`getWeekdayDatesInMonth`, matching `PickUpSchedule`'s Mon–Fri convention), each either an existing record or an unpersisted stub.
- Checking Lunch/Transport for a stub day seeds its cost from the school's standard price and materializes it into `allAttendanceRecords` (`ensurePersisted()`); a day never touched is never sent to the API. Transport implies Lunch (unchecking Lunch cascades to Transport). Uses `(ngModelChange)`, not `[(ngModel)]` + `(change)`, to avoid double-mutating the same property.
- `save()` → `AttendanceService.saveAttendance(scholarId, allAttendanceRecords)` (replaces the whole list server-side — not a per-day patch, see [[api]]). `exportCsv()` per-month.

**ScholarDetailComponent** (`scholar-detail/`, route `scholars/:id`) — read view for one scholar.
- `route.paramMap` piped through `switchMap` → fetch scholar (also triggers `AuditLogService.loadAuditLog(id)`) → `switchMap` → fetch its school.
- Renders parent info (formatted "Name — Phone", all fields optional), pickup schedule table, an audit trail card sourced from `AuditLogService` (entries/loading/error signals), and Edit/Delete/View-Attendance actions. `deleteScholar()` confirms via native `confirm()`.

**ScholarFormComponent** (`scholar-form/`, routes `create-scholar` and `scholars/update/:id`) — one component for both create and edit, `ReactiveFormsModule`.
- Mode determined by presence of route `:id`. Form: name, school (`<select>` from `SchoolsService`), grade (0–12), date of birth (required + custom future/invalid-date validator), optional mother/father name+phone (`PHONE_PATTERN` mirrors the API's `ValidatePhoneNumber` regex), nested weekday time inputs (`pickUpSchedule` FormGroup).
- On submit: builds a `Scholar`, calls `ScholarsService.createScholar`/`updateScholar`, notifies, navigates to the saved scholar's detail page on success (including the backend's validation message on failure).

**GlobalAuditLogComponent** (`global-audit-log/`, route `audit-log`) — paginated (`pageSize = 20`) view over `GlobalAuditLogService`'s signals (`entries`, `loading`, `error`, `totalItems`; `totalPages = computed(...)`). `clearAuditLog()` confirms, then `DELETE`s the entire log (no server-side auth guarding this — see [[api]] Gotchas) and reloads page 1. Rows for a deleted scholar (no `firstName`/`lastName`) render as plain text instead of a link.

**AboutComponent** (`about/`, route `about`) — dev/diagnostics page. Toggles `ApiLoggerService` (persisted to `localStorage`). `addTestScholars()` generates `TEST_SCHOLAR_COUNT = 20` randomized scholars (random names, school, grade, pickup schedule on the Gantt chart's 15-min slots, 1–2 months of randomized attendance priced from that scholar's school) and creates them sequentially via `ScholarsService`/`AttendanceService`, reporting a success/fail count. Also documents the app architecture inline in its template.

**NavbarComponent** (`navbar/`) — static nav links to `/scholars`, `/pickup-time`, `/attendance`, `/audit-log`, `/about`. No injected state.

**NotificationComponent** (`notification/`) — global toast host (rendered once, in `app.ts`), driven entirely by `NotificationService.notifications` (readonly signal); `dismiss(id)` per-toast.

**NotFoundComponent** (`not-found/`) — wildcard (`**`) route target, static link back.

## Services

- **`ScholarsService`** — CRUD over `{baseUrlScholars}` (`GET`/`POST`/`PUT /{id}`/`DELETE /{id}`, matching `ScholarsController`). Shared `handleError` extracts the API's validation-dict or message into a thrown `Error`. No caching, no signal state.
- **`SchoolsService`** — fetches `assets/schools.json` **once**, cached via `shareReplay(1)` (`schoolsCache$`); `getSchoolById()` derives from it. Falls back to `[]` on error.
- **`AttendanceService`** — `getAllScholarAttendance()`, `getAttendanceByScholarId(id)`, `saveAttendance(id, records)` (full-list upsert), `deleteAttendance(id)`. Deliberately **no caching** — the dashboard needs fresh data after edits made on the per-scholar page.
- **`AuditLogService`** — per-scholar audit signal state (`entries`/`loading`/`error`), `loadAuditLog(scholarId)`.
- **`GlobalAuditLogService`** — paginated global audit signal state (`entries`/`loading`/`error`/`pageNumber`/`totalItems`), `loadAllAuditLog({pageNumber, pageSize})`, `clearAuditLog()`.
- **`SortingService`** — generic `sort<T>(data, column, type: 'string'|'number'|'date', isAscending)`; nulls always sort to the "outside" regardless of direction. Shared by `ScholarTableComponent` and `AttendanceComponent`.
- **`CsvExportService`** — pure client-side CSV building + Blob download (`export<T>(filenamePrefix, columns, rows)`), timestamped filename. No export API endpoint exists server-side — every table already holds its full dataset in memory.
- **`NotificationService`** — signal-backed toast list (`show(message, type, durationMs=3000)`, auto-dismiss + manual `dismiss(id)`). Used everywhere instead of `alert()`.
- **`HealthService`** — `checkApiHealth()` (GET `/health`, maps HTTP ok→bool), `pollApiHealth()` (`timer(0, 15000)` + `switchMap`). Consumed only by `app.ts`, browser-only.
- **`ApiLoggerService`** + **`apiLoggerInterceptor`** — toggle (persisted to `localStorage`, default on) that makes every HTTP request/response/error print to the browser console (color-coded), skipped entirely during SSR.

## Interfaces

Mirror the API's C# models 1:1 (see [[api]]): `Scholar`, `PickUpSchedule` (optional `monday`–`friday: string | null`), `AttendanceRecord`, `ScholarAttendance` (`{scholarId, attendance}`), `School`, `TimeSlot`, `AuditLogEntry`, `GlobalAuditLogEntry` (adds nullable `firstName`/`lastName`), `PagedResponse<T>`.

## Gotchas / conventions

- **Unit tests** — Vitest, via the `@angular/build:unit-test` builder (`ng test` / `npm test`), config in `vitest-base.config.ts`. Covers pure-logic units only so far: `SortingService`, `CsvExportService`, `getWeekdayDatesInMonth` (`src/app/utils/weekday-dates.spec.ts`, `src/app/services/*.spec.ts`). No component/TestBed tests yet — nothing exercises `HttpClientTestingModule`, routing, or template rendering.
- **`SchoolId` on `Scholar` is not a DB foreign key** — schools live only in `assets/schools.json`, resolved client-side. Don't assume a `Schools` table or a schools API endpoint exists.
- **Zoneless + Signals throughout** — state that needs to trigger re-render must be a `signal`/`computed`, not a plain field mutated in place (the one intentional exception: `ScholarTableComponent.scholars`/`schools` plain fields are write-once scratch state, not read reactively by the template).
- All 11 routes are lazy (`loadComponent`) — adding a new route should follow the same pattern rather than an eager `component:` reference, to keep the initial bundle from growing.
- `GanttChartComponent`'s per-cell lookup map (`cellsByKey`) must stay a `computed()` keyed off `scholars()` — recomputing style/label inline per template call again would reintroduce the O(days × scholars × slots) per-change-detection cost it was written to eliminate.
- `NotificationService.show(...)`, not `alert()` — every component that used to call `alert()` has been migrated; keep new user-facing feedback consistent with that.
