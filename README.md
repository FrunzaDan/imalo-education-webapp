# Imalo Education Webapp

Imalo Education Webapp is a full-stack app for the day-to-day admin of an afterschool program. It tracks the scholars (students) and their parents, the weekly schedule of when each scholar is picked up, and daily attendance, including whether they had lunch or used transport. Lunch and transport are priced per school, so the attendance pages can show what each day costs. The app is made of an Angular UI, a single-project ASP.NET Core Web API and a SQL Server database, using plain ADO.NET with parameterized SQL instead of an ORM. It's a learning project meant to run on a local machine, which is why it deliberately has no login.

---

## Key Features

- **Scholar records:** Scholars can be created, viewed, edited and deleted, each with their parents' contact details and the school they attend. Deleting a scholar also removes their parents, schedule and attendance, so no orphaned data is left behind.
- **Weekly pickup schedule:** Each scholar has a pickup time for each day of the week. A Gantt-style chart shows all of them together, so it's easy to see who is still there at any point in the afternoon.
- **Attendance tracking:** A monthly grid shows attendance for every scholar at once. A per-scholar editor records presence, lunch and transport day by day for a chosen month, and fills in each day's cost from the school's prices.
- **Dashboard and charts:** The dashboard gives an overview of the current day, and the charts page summarizes the scholar and attendance data with the app's own SVG chart components (no chart library).
- **Audit log:** Every change to a scholar is logged. Each scholar has their own history, and a paged global log shows every change across the app.
- **CSV export and test data:** The scholar list and attendance can be exported to CSV. The About page generates demo scholars with random schedules and attendance, so every page has data to show.
- **One-command scripts:** `run.sh` starts the SQL Server container in Docker, deploys the schema, and runs the API and the Angular dev server. `build.sh` builds the API, the database project and the UI and runs both test suites, without starting any services.

---

## Tech Stack

- **Frontend:** Angular 22.2 (standalone components, signals, zoneless), SSR via `@angular/ssr` + Express, TypeScript
- **Backend:** ASP.NET Core Web API on .NET 10, a single project with one controller (`ScholarsController`) and a data-access class
- **Database / Storage:** SQL Server (Azure SQL Edge in Docker), ADO.NET with parameterized inline SQL (no ORM, no stored procedures), SSDT project deployed with `sqlpackage`
- **Tooling & Other:** OpenAPI + Swagger UI, xUnit v3 + Moq (Microsoft Testing Platform), Vitest + jsdom, ESLint (angular-eslint), Prettier, .NET analyzers (latest-recommended) + dotnet format, Postman collection

---

## Prerequisites

Before running this project, ensure you have the following installed:

- .NET 10 SDK (10.0.401 or newer, pinned in `global.json`)
- .NET 8 SDK (the database project's `src/DB/ImaloEducation/global.json` pins it for the SQL build tooling)
- Node.js `^22.22.3`, `^24.15.0` or `>=26` with npm
- Docker Desktop (runs the SQL Server container)
- A trusted ASP.NET Core dev certificate: `dotnet dev-certs https --trust` (once per machine)

`sqlpackage` is installed automatically as a global dotnet tool by `run.sh` if it is missing.

---

## Local Setup & Running

### 1. Clone the repository

```bash
git clone https://github.com/FrunzaDan/imalo-education-webapp.git
cd imalo-education-webapp
```

### 2. Configuration

The defaults work for local development. Settings live in `src/API/ImaloEducationApi/ImaloEducationApi/appsettings.json`:

- `ConnectionStrings:Docker` points at the container on `localhost,1433`. On Windows, the API falls back to `ConnectionStrings:LocalSqlServer` (Windows auth) if Docker doesn't answer.
- `Cors:AllowedOrigins` allows the Angular dev server on port 4203.

School reference data (name, color, lunch and transport prices) is not in the database. It lives in `src/UI/public/assets/schools.json`, so edit that file to change schools or prices.

`run.sh` reads these environment variables if you need to override the defaults: `SQL_SA_PASSWORD`, `SQL_PORT`, `SQL_CONTAINER_NAME`, `SQL_IMAGE`, `SQL_PLATFORM` (defaults to `linux/arm64` on Apple Silicon and `linux/amd64` elsewhere), `SQL_DATABASE` and `API_URL`. It passes the resulting connection string to the API, so a changed port or password doesn't need an `appsettings.json` edit. Its logs (API output, `sqlpackage` output) go to `.run/`.

### 3. Installation & Run

```bash
./run.sh
```

This starts Docker if needed, creates or starts the `sqlserver` container, builds and publishes the database schema, starts the API in the background on `https://localhost:7244`, and then runs the Angular dev server in the foreground on `http://localhost:4203` and opens it in your browser. `Ctrl+C` stops the API and Angular; the database container keeps running. The script is safe to re-run.

To build and test everything without starting any services:

```bash
./build.sh
```

That restores and builds the .NET solution with warnings treated as errors, checks it with `dotnet format --verify-no-changes`, runs the xUnit tests, and builds the SQL project. For the UI it runs `npm ci`, the Prettier check, ESLint, the production build and the Vitest suite. Pass `--skip-tests` to skip both test steps.

---

## Database & Migrations

There are no EF migrations. The schema is an SSDT project in `src/DB/ImaloEducation` with five tables: `Scholar`, `ScholarParent`, `ScholarPickupSchedule`, `ScholarAttendance` and `ScholarAuditLog`. `run.sh` builds it into a `.dacpac` and publishes it with `sqlpackage`, which applies only the differences.

Deleting a scholar cascades to their parents, schedule and attendance. `SchoolId` on a scholar is a plain integer that matches `schools.json`; it is not a foreign key.

The `sqlserver` container (port 1433) is the same one the Customer and Employee Management apps use; each app has its own database.

---

## API / App Usage

All routes are under `api/scholars`. Swagger UI is at `https://localhost:7244/swagger` in Development, and there's a Postman collection in `src/API/Postman/`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/` | Create a scholar (returns `201`) |
| GET | `/` | List all scholars |
| GET / PUT / DELETE | `/{scholarId}` | Read, update or delete one scholar |
| GET | `/{scholarId}/audit-log` | One scholar's change history |
| GET / DELETE | `/audit-log/all` | Paged global audit log (`pageNumber`, `pageSize`), or clear it |
| GET | `/attendance` | Attendance for every scholar |
| GET / POST / DELETE | `/{scholarId}/attendance` | Read, replace or clear one scholar's attendance |
| GET | `/health` (root) | Liveness check, polled by the UI |

Successful responses return the model directly; errors are RFC 9457 Problem Details, with exception text only in Development.

---

## License & Notes

Personal learning project with no license file.

- There is no authentication. The app is meant to run on a local machine only, with CORS limited to the UI's origin.
- The SQL in `ScholarDataAccess` has no automated tests, since that would need a real SQL Server. The API tests cover the models, controller, endpoint contracts, error responses and startup validation.
- More detailed technical notes per layer are in [`ai_docs/`](ai_docs/index.md).
