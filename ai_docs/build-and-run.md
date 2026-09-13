# Build and Run

## What it is

How to compile and run the three layers (DB, API, Angular UI) locally, via `build.sh` (compile-only) and `run.sh` (full dev environment), plus what the Angular SSR/build config does.

## Key files / paths

- `build.sh` — repo root, compile only, no live services, no tests (none exist — see [[api]]/[[database]] Gotchas).
- `run.sh` — repo root, full dev environment orchestration.
- `.run/` — gitignored logs written by `run.sh` (`api.log`, `sqlpackage.log`).
- `ImaloEducationDB/global.json` — pins the DB project's build to the .NET 8 SDK.
- `Frontend/angular.json` — `outputMode: "server"`, `ssr.entry: src/server.ts`.
- `Frontend/src/server.ts` — standalone Node/Express SSR server.
- `Frontend/src/environments/environment.ts` — `baseUrlScholars: http://localhost:5244/api/Scholars`, `healthUrl: http://localhost:5244/health`.

## `build.sh`

CI-style, one-shot, proves everything compiles:
1. `dotnet restore`/`build` the API (`ImaloEducationApi.csproj`, Debug).
2. `dotnet restore`/`build` the DB `.sqlproj` (Debug).
3. `npm ci && npm run build` the Angular app.

No services are started, nothing is deployed, no tests run. Run before committing API/DB/UI changes.

## `run.sh`

Full local dev environment, idempotent (safe to re-run):

1. **Docker.** Starts Docker Desktop if not running (macOS: `open -a Docker`, then polls up to 2 min).
2. **SQL Server container.** Azure SQL Edge (`mcr.microsoft.com/azure-sql-edge`) — the only Microsoft SQL Server image with a working Apple Silicon/arm64 build. Container name `sqlserver`, port `1433`, `sa` password `MyStrongPassw0rd?` (matches `appsettings.json`) — **shared with other local .NET projects on this machine** (same container/port/password convention, e.g. Customer_Management_System); each project just targets its own DB name inside it. An existing container is `docker start`ed, not recreated; a missing one is pulled and created fresh (`--platform linux/arm64`).
3. **Schema deploy.** Installs `sqlpackage` (pinned to `170.3.93` as a global dotnet tool — newer releases can need a .NET runtime patch this machine doesn't have), builds the `.sqlproj`, then retries `sqlpackage /Action:Publish ... /p:BlockOnPossibleDataLoss=false` with jittered backoff (3–6s) for up to 180s. It retries the *real* publish rather than a separate readiness probe because Azure SQL Edge ships no `sqlcmd`/`mssql-tools` inside the container to probe with. `BlockOnPossibleDataLoss=false` because this is a disposable local dev DB that gets iterated on — SSDT's default guard would otherwise refuse any table rebuild against a table with existing rows.
4. **API.** Starts in the background: `ASPNETCORE_ENVIRONMENT=Development dotnet run --project ImaloEducationApi --launch-profile ImaloEducationApi`, plain HTTP at `http://localhost:5244` (read from `Properties/launchSettings.json`'s `applicationUrl`, falling back to that default). Waits for `/swagger/index.html` to respond (up to 60s). Logs to `.run/api.log`.
5. **Angular.** Starts in the foreground: `npm start` (`ng serve`) at `http://localhost:4200`. `Ctrl+C` stops both API and Angular (`trap cleanup EXIT INT TERM`).

Both scripts fail fast with a clear message if `dotnet`/`node`/`npm`/`docker`/`curl` are missing, or if a needed port is already occupied by something other than the expected container/process (pure-bash `/dev/tcp` probe, no `nc`/`lsof` dependency).

## Manual Docker SQL Server (equivalent of what `run.sh` step 2 automates)

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

## Angular build/serve/SSR

- `npm start` (`ng serve`) — dev server, no SSR involved. This is what `run.sh` uses; it never touches the standalone Node SSR server.
- `npm run build` (`ng build`) — esbuild-based Angular application builder. Produces `dist/imalo-education-webapp/browser` (client bundle, code-split per lazy route — see [[angular-frontend]]) and `dist/imalo-education-webapp/server` (SSR server bundle, `server.mjs`), plus prerenders `create-scholar` and `about` at build time (`app.routes.server.ts` — everything else renders server-side per-request, `RenderMode.Server`, since it depends on live API data the build machine may not have running).
- `npm run serve:ssr:ImaloEducationWebapp` — runs the built standalone SSR server (`node dist/imalo-education-webapp/server/server.mjs`, port 4000 by default). Requires `angular.json`'s `outputMode: "server"` (without it, `server.mjs` bundles `server.ts` but never registers the Angular app engine manifest, and crashes on startup) and `src/server.ts`'s `AngularNodeAppEngine` to be given `allowedHosts: ['localhost', '127.0.0.1']` (bare hostnames — Angular 22's SSRF host-header hardening strips the port before comparing, so `'localhost:4000'` does not match). Only relevant when actually deploying the built SSR output — not part of the normal `run.sh` dev loop.

## Gotchas / conventions

- **`ImaloEducationDB/global.json` pins the .NET 8 SDK.** The `.sqlproj`'s `Microsoft.Build.Sql` SDK (`1.0.0`) unconditionally imports `NuGet.Build.Tasks.Pack` from whichever .NET SDK is currently selected — the .NET 10 SDKs installed on this machine (`10.0.100`, `10.0.300`) don't ship that folder, only `8.0.417` does, so building the `.sqlproj` fails with `MSB4019` without the pin. Unrelated to the API's `net10.0` target (the DB project isn't a `.csproj`). If a fresh machine's SDKs all include `NuGet.Build.Tasks.Pack`, this pin becomes a no-op — don't remove it speculatively without checking a real build first.
- **`sqlpackage` version is pinned deliberately** — don't bump it without checking it actually runs against the .NET runtime installed on the target machine.
- No TLS/dev-cert setup needed anywhere in this stack — the API has no HTTPS profile and `environment.ts` points at plain `http://localhost:5244`.
- No seed data, no test login — the DB schema is created purely by the pre-deployment script + `.sqlproj` tables, and the app has no auth (see [[api]]).
