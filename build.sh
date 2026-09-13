#!/usr/bin/env bash
# Restores and builds the .NET API and the SQL database project, then installs
# dependencies and builds the Angular app. CI-style, one-shot: proves everything
# compiles. No automated tests exist yet in either the API or the Angular app
# (see ai_docs/known-gaps.md), so none are run here.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_PROJ="$ROOT_DIR/ImaloEducationApi/ImaloEducationApi.csproj"
DB_DIR="$ROOT_DIR/ImaloEducationDB"
DB_PROJ="ImaloEducationDB.sqlproj"
UI_DIR="$ROOT_DIR/Frontend"

echo "==> [1/5] Checking prerequisites"
missing=()
for cmd in dotnet node npm; do
  command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
done
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required tool(s): ${missing[*]}" >&2
  echo "  - .NET SDK: https://dotnet.microsoft.com/download" >&2
  echo "  - Node.js (includes npm): https://nodejs.org/" >&2
  exit 1
fi

echo "==> [2/5] Restoring .NET API"
dotnet restore "$API_PROJ"

echo "==> [3/5] Building .NET API"
dotnet build "$API_PROJ" --no-restore --configuration Debug

echo "==> [4/5] Building database project"
(
  cd "$DB_DIR"
  dotnet restore "$DB_PROJ"
  dotnet build "$DB_PROJ" --no-restore --configuration Debug
)

echo "==> [5/5] Building Angular app"
(
  cd "$UI_DIR"
  npm ci
  npm run build
)

echo "==> Build complete."
