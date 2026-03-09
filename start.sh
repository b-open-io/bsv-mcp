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

# Install deps if missing (first run from plugin cache)
if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
  (cd "$SCRIPT_DIR" && bun install) >&2
fi

exec bun run "$SCRIPT_DIR/index.ts"
