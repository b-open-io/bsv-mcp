#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source .env if present
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

export TRANSPORT=stdio

# Prefer source with node_modules (local dev), fall back to pre-built bundle
if command -v bun >/dev/null 2>&1 && [[ -d "$SCRIPT_DIR/node_modules" ]]; then
  exec bun run "$SCRIPT_DIR/index.ts"
elif command -v bun >/dev/null 2>&1; then
  exec bun run "$SCRIPT_DIR/build/server.js"
else
  exec node "$SCRIPT_DIR/build/server.js"
fi
