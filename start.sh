#!/usr/bin/env bash
# Wrapper script to launch the BSV MCP server.
# The server inherits env vars from your shell (export PRIVATE_KEY_WIF=... in ~/.zshrc).
# Optionally, place a .env file next to this script or at ~/.config/bsv-mcp/.env.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source .env if present (local dev or user-created)
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
elif [[ -f "$HOME/.config/bsv-mcp/.env" ]]; then
  set -a
  source "$HOME/.config/bsv-mcp/.env"
  set +a
fi

# Use bun + source TS if node_modules are present (local dev).
# Otherwise use the pre-built Node.js bundle (plugin cache has no node_modules).
if command -v bun >/dev/null 2>&1 && [[ -d "$SCRIPT_DIR/node_modules" ]]; then
  exec bun run "$SCRIPT_DIR/index.ts" --stdio
elif command -v bun >/dev/null 2>&1; then
  exec bun run "$SCRIPT_DIR/build/server.js" --stdio
else
  exec node "$SCRIPT_DIR/build/server.js" --stdio
fi
