# Angular Frontend

## What it is

The Angular 22 app under `UI/`. It is zoneless, uses standalone components and signals, and renders with SSR. It has no login.

## Key files / paths

- `src/environments/environment.ts` — `apiUrl` (`http://localhost:5244`), `phoneNumberRegex`.
- `src/app/app.config.ts`, `app.config.server.ts`, `app.routes.ts`, `app.routes.server.ts`, `app.ts` (the shell).
- `src/app/services/`:
  - `scholar`, `school`, `attendance`, `audit-log`, `global-audit-log`;
  - `sorting`, `csv-export`;
  - the shared helpers (`notification`, `confirm-dialog`, `api-logger`, `health`, `unsaved-changes.guard`, `app-title-strategy`).
- `src/app/components/` — one folder per page or widget.
- `src/app/interfaces/` — mirrors of the API's JSON.
- `src/app/utils/`:
  - `extract-error-message.ts`, `audit-action-label.ts`;
  - `weekday-dates.ts`, `contrast-color.ts`.
- `src/app/constants/week-days.ts` — `WEEK_DAYS` and the `WeekDay` type.
- `src/app/utils/chart-scale.ts` — chart axis math, shared with the customer app.
- `src/app/pipes/ron.pipe.ts`, `src/styles.css`.
- `public/assets/schools.json` — school data. `SchoolService` loads it once (`shareReplay`) and returns `[]` if it fails.

## How it works

### Config

- `app.config.ts` sets up:
  - `provideZonelessChangeDetection()`;
  - the router, with component input binding, view transitions and `canceledNavigationResolution: 'computed'`;
  - hydration with event replay;
  - `provideHttpClient(withFetch(), withInterceptors([apiLoggerInterceptor]))`.
- **Render modes:** `create-scholar` and `about` are prerendered; everything else renders on the server per request.
- Every route is lazy and has a `title` (" · Imalo Education Webapp").

### Routes

| Route | Component |
|---|---|
| `/` → `/dashboard` | `dashboard` (KPIs, today's pickups, upcoming birthdays, recent activity) |
| `/scholars` | `scholar-list` (client-side search, sort, bulk delete, CSV) |
| `/scholars/:scholarId` | `scholar-details` (parents, schedule, audit trail, delete) |
| `/create-scholar`, `/scholars/update/:scholarId` | `scholar-form` (one component for add and edit) |
| `/pickup-time` | `gantt-chart` (days × scholars × 15-min slots, colored by school) |
| `/attendance` | `attendance` (monthly grid for every scholar) |
| `/attendance/:scholarId` | `attendance-per-scholar` (editable month) |
| `/charts` | `charts` (monthly, yearly and roster charts; inline SVG `bar-chart`) |
| `/audit-log` | `global-audit-log` |
| `/about` | `about` (API-logging toggle, 20-scholar test-data generator) |
| `**` | `page-not-found` |

### Data loading

- **Every read is a resource.** `subscribe()` is only for one-off actions such as save, delete and export.
- **Pages** load with `rxResource({ stream: () => forkJoin({...}) })`:
  - values are `computed`s guarded by `hasValue()`;
  - `loading` is `isLoading`;
  - `loadError` comes from `extractErrorMessage`.
- **`scholar-list`:**
  - `loading` is the first load only, so a reload keeps the table on screen;
  - `selectedScholarIds` is a `linkedSignal` that clears whenever the rows reload;
  - a bulk delete calls `data.reload()`;
  - the sort signals survive the reload.
- **`attendance-per-scholar`:**
  - one `rxResource` keyed on `scholarId` loads the scholar, then (with `switchMap`) its attendance;
  - a second `rxResource` loads the school;
  - a failed load shows an alert, never an empty grid. Saving replaces the whole list, so saving over a failed load would erase data.
- **`scholar-details` and `scholar-form`:** use `rxResource` keyed on the route id. The form's model is a `linkedSignal` over the loaded scholar.
- **`AuditLogService` and `GlobalAuditLogService`:**
  - built on `httpResource`, keyed on a signal;
  - a newer request cancels the older one;
  - a `linkedSignal` keeps the last page on screen while the next loads.
- **Health banner:** `HealthService` polls `/health` every 15 s, in the browser only.

### Charts (`/charts`)

- The charts are hand-built inline SVG, with no chart library. The pure transforms live in `charts/charts-data.ts`, which has a spec.
- **One component:** `bar-chart` draws plain bars, or stacked bars when points carry `value2` (Transport on top of Lunch), and then shows a legend.
- **Sections:**
  - **Monthly overview:** a month picker; present and revenue per weekday.
  - **Yearly overview:** a year picker; present and revenue per month.
  - **Scholars overview:** headcount by class (ordered by grade) and by school (ranked by count).

  Each section also has stat tiles.
- **Data:** one `rxResource` + `forkJoin` loads scholars, all attendance and schools. Only present days count, and a cost counts only when it is selected.
- **Axis and labels:** the axis math comes from the shared `utils/chart-scale.ts`. Money labels are whole RON through the `ron` pipe (`ron.transform(value, '1.0-0')`), as in the customer charts.
- **Hover and focus:** each bar band is focusable and shows a custom tooltip.
- **Colors:** series a is `--cyan-main-color` and series b is `--orange-text-color`. They are the only two tokens that pass contrast as full-size fills.

### Forms (Signal Forms)

- `form()`, `[formField]` and `[formRoot]`. There is no Reactive Forms and no `ngModel`.
- **Scholar form:** `scholar-form.ts` holds `ScholarFormModel`, `scholarFormSchema`, `toFormModel` and `toScholar`.
- **Attendance grid:** `attendance-form.ts` holds the attendance form.
  - `days` is a `linkedSignal`, so unsaved edits survive a month change.
  - Lunch and Transport are disabled unless Present is checked. Unchecking Present clears both.
  - "Both" is a plain checkbox that sets both fields.
- **Unsaved changes:** `unsavedChangesGuard` plus `beforeunload` on the scholar form and on the per-scholar attendance page.

### User feedback (same in all three apps)

- **Success:** a toast, fired by the service in `tap`. Bulk callers use the `…Silently` variants and show one summary toast.
- **Failed action:** an inline `.app-alert` (`role="alert"`), with text from `extractErrorMessage`.
- **Failed page load:** an alert in place of the content.
- **Confirmations:** `ConfirmDialogService.confirm(...)`, never `window.confirm()`.
- **API logging:** `apiLoggerInterceptor` logs API calls to the console, in the browser only. It can be toggled on the About page.

### Styling

- Custom CSS only, with no Bootstrap or Tailwind. Tokens and the `.app-button`, `.app-input`, `.app-table`, `.app-card`, `.page-title`, `.page-toolbar` and `.app-alert` classes are in `styles.css`.
- Spacing uses `gap` and `--space-*` tokens. Buttons and inputs have no margins.
- Display formats: text is sentence case, money uses the `ron` pipe, dates use `longDate`, timestamps use `medium`.
- For orange text, use `--orange-text-color`, because `--orange-main-color` fails contrast on white.
- Accessibility (WCAG 2.2 AA):
  - one `<h1>` per page, focused after navigation;
  - a skip link;
  - `prefers-reduced-motion` is respected.

### Tests

- Vitest through `@angular/build:unit-test`, using the default `ng new` setup.
- **Pure units:** tested with `new`.
- **Component specs:** use `TestBed` with plain-object service fakes and `setInput('scholarId', …)`, then `await fixture.whenStable()` for resources.
- **Components with specs:**
  - `scholar-list`, `scholar-details`, `scholar-form`;
  - `attendance-per-scholar`;
  - `notification`, `confirm-dialog`.
- **Audit services:** tested with `HttpTestingController`.

## Gotchas / conventions

- The app is zoneless, so any state the template reads must be a signal.
- `value()` throws while a resource is in error. Guard reads with `hasValue()`.
- **Dates:**
  - Parse `'YYYY-MM-DD'` with `parseDateOnly`, never `new Date(...)`, which reads it as UTC and can shift a day.
  - Month pickers default to `DEFAULT_MONTH` (`'2026-09'`).
- **Signal Forms:**
  - native controls update on the `input` event;
  - build API payloads field by field, because array items carry a hidden symbol-keyed property.
- **SSR response size:** `app.config.server.ts` raises the SSR fetch limit to 10 MB. `GET /attendance` outgrew the default 1 MB.
- **Gantt chart:** its `cellsByKey` must stay a `computed`, for performance.
- **Shared files:** `notification`, `confirm-dialog`, `api-logger`, `extract-error-message`, `ron.pipe` and `audit-action-label` are identical in all three apps. Change them together. `utils/chart-scale.ts` (axis math: `niceMax`, `formatTick`) is identical in the customer and Imalo apps; the employee app has no charts.
