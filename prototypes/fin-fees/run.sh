#!/usr/bin/env bash
# FIN-FEES local prototype runner — SYNTHETIC DATA ONLY.
#
# It never deploys and never reads production. It builds a throw-away workspace
# outside every repo:
#   app/                 copied from this folder
#   src/index.css        taken from salown-app HEAD (theme tokens only)
#   node_modules         symlink to salown-app/node_modules (read-only use)
# The shared salown-app dev server (5173) and its Vite cache are never touched.
#
#   ./run.sh check                       typecheck + model tests
#   PROTO_PORT=5288 ./run.sh serve       serve on http://127.0.0.1:$PROTO_PORT/
#                                        refuses to start if the port is already in use
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP_REPO="${SALOWN_APP:-$HERE/../../../salown-app}"
BASE="${TMPDIR:-/tmp}"
WS="${BASE%/}/salown-fin-fees-proto"
PORT="${PROTO_PORT:-5288}"

prepare() {
  [ -d "$APP_REPO/node_modules" ] || { echo "salown-app node_modules not found under $APP_REPO (set SALOWN_APP)" >&2; exit 1; }
  case "$WS" in
    */salown-fin-fees-proto) ;;
    *) echo "refusing unexpected workspace path: $WS" >&2; exit 1 ;;
  esac
  rm -rf "$WS"
  mkdir -p "$WS/src"
  cp -R "$HERE/app" "$WS/app"
  cp "$HERE/vite.proto.config.js" "$WS/"
  git -C "$APP_REPO" show HEAD:src/index.css > "$WS/src/index.css"
  ln -s "$(cd "$APP_REPO" && pwd)/node_modules" "$WS/node_modules"
}

case "${1:-}" in
  check)
    prepare
    cd "$WS"
    npx tsc --noEmit -p app/tsconfig.json
    npx vitest run --config vite.proto.config.js
    ;;
  serve)
    if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "port $PORT is already in use — choose another with PROTO_PORT" >&2
      exit 1
    fi
    prepare
    cd "$WS"
    PROTO_PORT="$PORT" exec npx vite --config vite.proto.config.js
    ;;
  *)
    echo "usage: [PROTO_PORT=5288] $0 check|serve" >&2
    exit 2
    ;;
esac
