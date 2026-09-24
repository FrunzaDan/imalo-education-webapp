# Build & Run

## What it is

How to build, test and run the database, API and UI locally.

## Key files / paths

- `build.sh`:
  1. restores and builds the API;
  2. runs `dotnet test`;
  3. builds the DB project;
  4. runs `npm ci`, `npm run format:check` and `npm run build`;
  5. runs `npm test`.

  It starts nothing.
- `run.sh` — the full dev environment. Safe to re-run.
- `.run/` — logs (`api.log`, `sqlpackage.log`), gitignored.
- `.vscode/` — shared VS Code tasks (`run.sh`, `build.sh`, `ng serve`, `ng test`), launch configs (API, `ng serve`, `ng test` in Node, "API + UI") and recommended extensions. Same in all three sibling apps. Open the repo root, not `UI/`.
- `global.json` (repo root) — .NET 10 SDK, and `dotnet test` on Microsoft Testing Platform.
- `DB/ImaloEducation/global.json` — pins .NET 8 for the DB project. Keep it.
- `UI/angular.json` — `outputMode: "server"`, dev server on port 4204.

## How it works

### `run.sh`

1. Starts Docker, then starts or creates the `sqlserver` container (Azure SQL Edge on port 1433). The container is shared with the sibling apps; each app uses its own database.
2. Installs `sqlpackage` 170.3.93 if it's missing, builds the `.sqlproj`, and publishes it with `BlockOnPossibleDataLoss=false`, retrying for up to 180 s.
3. Starts the API at `http://localhost:5244` (Development) with `ConnectionStrings__Docker` pointing at that container, and waits up to 60 s for it.
4. Starts `npm start` at `http://localhost:4204`. `Ctrl+C` stops both.

- It fails fast if a tool is missing or a port is taken.
- You can override these environment variables: `SQL_PORT`, `SQL_SA_PASSWORD`, `SQL_DATABASE`, `SQL_CONTAINER_NAME`, `SQL_IMAGE`, `SQL_PLATFORM` and `API_URL`.

### Manual Docker equivalent

```bash
docker run -e "ACCEPT_EULA=1" -e "MSSQL_SA_PASSWORD=MyStrongPassw0rd?" \
  -p 1433:1433 --name sqlserver --platform linux/arm64 -d mcr.microsoft.com/azure-sql-edge
```

### Which database the API uses

- **macOS:** always the Docker container.
- **Windows:** the Docker container if it answers within 3 s. Otherwise the local SQL Server (`ConnectionStrings:LocalSqlServer`, Windows auth).
- The choice is logged at startup. On Windows, start Docker before the API. See [api](api.md).

### SSR build

- `npm run build` outputs `dist/imalo-education-webapp/browser` and `dist/imalo-education-webapp/server`.
- `npm run serve:ssr:imalo-education-webapp` runs the built server on port 4000, with `NG_ALLOWED_HOSTS=localhost,127.0.0.1`. That's only needed for deploying; `run.sh` doesn't use it.

## Gotchas / conventions

- There's no TLS or dev-certificate setup, because everything is plain HTTP.
- There's no seed data and no test login.
- `sqlpackage` is pinned; don't bump it without checking the installed .NET runtime.
- **Formatting:** Prettier (`npm run format`, `npm run format:check`), configured the same in all three apps.
