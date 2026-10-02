# Imalo Education Webapp

A full-stack app for an afterschool program to track scholars (students), their parents, weekly pickup schedules and daily attendance, including lunch and transport. It's a learning project for practising Angular + ASP.NET Core + SQL Server end to end, and it runs locally only.

---

## 🚀 Key Features

- **Scholar records:** Create, view, edit and delete scholars, each with their parents and a weekly pickup schedule.
- **Pickup time chart:** A Gantt-style view of when each scholar is picked up during the week.
- **Attendance tracking:** A monthly attendance grid for all scholars, plus a per-scholar editor that records presence, lunch and transport for each day and prices them using the school's rates.
- **Dashboard and charts:** Overview numbers for the day and charts built from the scholar and attendance data.
- **Audit log:** Per-scholar history plus a paged global log of every change.
- **CSV export and test data:** Export the scholar list and attendance to CSV, and generate demo scholars with random schedules and attendance from the About page.

---

## 🛠 Tech Stack

- **Frontend:** Angular 22.2 (standalone components, signals, zoneless), SSR via `@angular/ssr` + Express, TypeScript
- **Backend:** ASP.NET Core Web API on .NET 10, a single project with one controller (`ScholarsController`) and a data-access class
- **Database / Storage:** SQL Server (Azure SQL Edge in Docker), ADO.NET with parameterized inline SQL (no ORM, no stored procedures), SSDT project deployed with `sqlpackage`
- **Tooling & Other:** OpenAPI + Swagger UI, xUnit v3 + Moq (Microsoft Testing Platform), Vitest + jsdom, Prettier, Postman collection

---

## 📋 Prerequisites

Before running this project, ensure you have the following installed:

- .NET 10 SDK (10.0.401 or newer, pinned in `global.json`)
- .NET 8 SDK (the database project's `DB/ImaloEducation/global.json` pins it for the SQL build tooling)
- Node.js `^22.22.3`, `^24.15.0` or `>=26` with npm
- Docker Desktop (runs the SQL Server container)

`sqlpackage` is installed automatically as a global dotnet tool by `run.sh` if it is missing. The API runs on plain HTTP, so no dev certificate is needed.

---

## ⚙️ Local Setup & Running

### 1. Clone the repository

```bash
git clone https://github.com/FrunzaDan/imalo-education-webapp.git
cd imalo-education-webapp
```

### 2. Configuration

The defaults work for local development. Settings live in `API/ImaloEducationApi/ImaloEducationApi/appsettings.json`:

- `ConnectionStrings:Docker` points at the container on `localhost,1433`. On Windows, the API falls back to `ConnectionStrings:LocalSqlServer` (Windows auth) if Docker doesn't answer.
- `Cors:AllowedOrigins` allows the Angular dev server on port 4204.

School reference data (name, color, lunch and transport prices) is not in the database. It lives in `UI/public/assets/schools.json`, so edit that file to change schools or prices.

`run.sh` reads these environment variables if you need to override the defaults: `SQL_SA_PASSWORD`, `SQL_PORT`, `SQL_CONTAINER_NAME`, `SQL_IMAGE` and `SQL_PLATFORM`.

### 3. Installation & Run

```bash
./run.sh
```

This starts Docker if needed, creates or starts the `sqlserver` container, builds and publishes the database schema, starts the API in the background on `http://localhost:5244`, and then runs the Angular dev server in the foreground on `http://localhost:4204`. `Ctrl+C` stops the API and Angular. The script is safe to re-run.

To build and test everything without starting any services:

```bash
./build.sh
```

---

## 🗄 Database & Migrations

There are no EF migrations. The schema is an SSDT project in `DB/ImaloEducation` with five tables: `Scholar`, `ScholarParent`, `ScholarPickupSchedule`, `ScholarAttendance` and `ScholarAuditLog`. `run.sh` builds it into a `.dacpac` and publishes it with `sqlpackage`, which applies only the differences.

Deleting a scholar cascades to their parents, schedule and attendance. `SchoolId` on a scholar is a plain integer that matches `schools.json`; it is not a foreign key.

The `sqlserver` container (port 1433) is the same one the Customer and Employee Management apps use; each app has its own database.

---

## 🔌 API / App Usage

All routes are under `api/scholars`. Swagger UI is at `http://localhost:5244/swagger` in Development, and there's a Postman collection in `API/Postman/`.

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

## 📝 License & Notes

Personal learning project with no license file.

- There is no authentication. The app is meant to run on a local machine only, with CORS limited to the UI's origin.
- The SQL in `ScholarDataAccess` has no automated tests, since that would need a real SQL Server. The API tests cover the models, controller, endpoint contracts, error responses and startup validation.
- More detailed technical notes per layer are in [`ai_docs/`](ai_docs/index.md).
