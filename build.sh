#!/usr/bin/env bash
# Restores, builds and tests the .NET API, then does the same for the Angular
# app. CI-style, one-shot: proves everything compiles and passes its tests.
# The SQL database project is built too (it has no tests to run), last, so it
# doesn't sit between the two primary build+test flows above.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_PROJ="$ROOT_DIR/API/ImaloEducationApi/ImaloEducationApi/ImaloEducationApi.csproj"
API_TEST_PROJ="$ROOT_DIR/API/ImaloEducationApi/ImaloEducationApi.Tests/ImaloEducationApi.Tests.csproj"
DB_DIR="$ROOT_DIR/DB"
DB_PROJ="ImaloEducationDB.sqlproj"
UI_DIR="$ROOT_DIR/UI"

echo "==> [1/6] Checking prerequisites"
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

echo "==> [2/6] Building .NET API"
dotnet restore "$API_PROJ"
dotnet build "$API_PROJ" --no-restore --configuration Debug

echo "==> [3/6] Testing .NET API"
dotnet test "$API_TEST_PROJ" --configuration Debug

echo "==> [4/6] Building Angular app"
(
  cd "$UI_DIR"
  npm ci
  npm run build
)

echo "==> [5/6] Testing Angular app"
(
  cd "$UI_DIR"
  npm test -- --watch=false
)

echo "==> [6/6] Building database project"
(
  cd "$DB_DIR"
  dotnet restore "$DB_PROJ"
  dotnet build "$DB_PROJ" --no-restore --configuration Debug
)

echo "==> Build complete."
