#!/usr/bin/env bash
# Launch the BSV MCP server via stdio transport.
# Env vars inherited from shell; optionally source .env files.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source .env if present
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
elif [[ -f "$HOME/.config/bsv-mcp/.env" ]]; then
  set -a
  source "$HOME/.config/bsv-mcp/.env"
  set +a
fi

# Use bun + source TS if node_modules present (local dev).
# Otherwise use the pre-built bundle (npm install / plugin cache).
if command -v bun >/dev/null 2>&1 && [[ -d "$SCRIPT_DIR/node_modules" ]]; then
  exec bun run "$SCRIPT_DIR/index.ts" --stdio
elif command -v bun >/dev/null 2>&1; then
  exec bun run "$SCRIPT_DIR/dist/index.js" --stdio
else
  exec node "$SCRIPT_DIR/dist/index.js" --stdio
fi
