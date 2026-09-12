# Local Dev Setup

## What it is

How to get the DB, API, and UI running on a dev machine.

## Key files / paths

- `build.sh` — repo root, compile only, no live services (no test step — see [[known-gaps]]).
- `run.sh` — repo root, full dev environment orchestration.
- `ImaloEducationDB/Scripts/Pre-Deployment/Script.PreDeployment.sql` — creates the `ImaloEducationDB` database if it doesn't already exist.
- `.run/` — gitignored logs written by `run.sh`.

## How it works

**Docker SQL Server (Azure SQL Edge)** — manual equivalent of what `run.sh` automates:
```bash
docker pull mcr.microsoft.com/azure-sql-edge

docker run \
  -e "ACCEPT_EULA=1" \
  -e "MSSQL_SA_PASSWORD=MyStrongPassw0rd?" \
  -p 1433:1433 \
  --name sqlserver \
  --platform linux/arm64 \
  -d mcr.microsoft.com/azure-sql-edge
```
- `sa` password for local dev is `MyStrongPassw0rd?` — matches `appsettings.json`'s `DefaultConnection` string and `run.sh`'s `SQL_SA_PASSWORD` default. Local-dev-only credential.
- Container name `sqlserver`, port `1433` — **shared with other local .NET projects on this machine** (e.g. Customer_Management_System uses the same container/port/password convention); each project just targets its own database name inside it (`ImaloEducationDB` here). `run.sh` reuses the container if it's already running rather than creating a second one.
- `--platform linux/arm64` is needed on Apple Silicon Macs.
- Azure SQL Edge does **not** ship `sqlcmd`/`mssql-tools` inside the container, so readiness can't be probed with the usual `docker exec ... sqlcmd` trick.

**`build.sh`** — CI-style, one-shot: `dotnet restore`/`build` on the API, `dotnet build` the DB `.sqlproj`, then `npm ci && npm run build` for Angular. Doesn't start anything or run tests (none exist yet, see [[known-gaps]]); just proves everything compiles. Run before committing API/DB/UI changes.

**`run.sh`** — full local dev environment, idempotent (safe to re-run):
1. Starts Docker Desktop if not running (macOS: `open -a Docker`), starts/creates the `sqlserver` container if needed (existing container is `docker start`ed, not recreated).
2. Installs `sqlpackage` (pinned to `170.3.93` — newer releases can need a .NET runtime patch this machine doesn't have) as a global dotnet tool if missing, builds the DB `.sqlproj`, and publishes the `.dacpac`, retrying with jitter (no `sqlcmd` in the container to probe readiness with, so it retries the *real* publish instead) until SQL Server accepts connections or 180s elapse.
3. Starts the API in the background (`dotnet run`, plain HTTP at `http://localhost:5244`), waits for `/swagger/index.html` to respond.
4. Starts the Angular dev server in the foreground (`npm start`, `http://localhost:4200`). `Ctrl+C` stops both API and Angular (trap on `EXIT INT TERM`).

## Gotchas / conventions

- **`ImaloEducationDB/global.json` pins the SQL project to the .NET 8 SDK.** The project's `Microsoft.Build.Sql` version (`1.0.0`) unconditionally imports `NuGet.Build.Tasks.Pack` from the currently-selected .NET SDK's `Sdks/` folder — but on this machine the installed 10.0.x SDKs (`10.0.100`, `10.0.300`) don't ship that folder at all (only `8.0.417` does), so building the `.sqlproj` fails with `MSB4019` unless something pins SDK selection to `8.0.417`. This is unrelated to the API's `net10.0` target — the DB project isn't a .csproj and doesn't need the .NET 10 SDK, it just needs an SDK whose MSBuild tooling is complete. If a fresh machine's SDKs *do* all include `NuGet.Build.Tasks.Pack`, this file becomes a no-op; don't remove it speculatively without checking a real build first.
- **No TLS/dev-cert setup needed here.** Unlike some sibling projects, the API has no HTTPS launch profile (`Properties/launchSettings.json` only defines the HTTP one) and the Angular `environment.ts` points at `http://localhost:5244` — so none of the browser-cert-trust or Node/SSR-cert-trust problems that come with an HTTPS dev API apply to this project.
- `sqlpackage` version is pinned deliberately (see comment in `run.sh`) — don't "helpfully" bump it without checking it runs against the .NET runtime actually installed.
- The DB schema is created purely by the pre-deployment script + `sqlproj` tables — there's no seed data and no test login (the app has no auth, see [[known-gaps]]).
- **`run.sh` (`npm start` / `ng serve`) does not use the standalone SSR Node server at all** — that's a separate path (`npm run serve:ssr:ImaloEducationWebapp`, i.e. `node dist/imalo-education-webapp/server/server.mjs`), only relevant if actually deploying the built SSR output. It requires `angular.json`'s `outputMode: "server"` and `src/server.ts`'s `AngularNodeAppEngine` to be given `allowedHosts: ['localhost', '127.0.0.1']` (bare hostnames — the validator strips the port before comparing) — both already set up; see [[known-gaps]] for the full root-cause writeup if either ever needs revisiting after a future Angular upgrade.
