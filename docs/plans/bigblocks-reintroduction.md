# BigBlocks Reintroduction Plan

Removed in 2026-03-09 to slim down the MCP server's production dependencies for plugin compatibility.

## What was removed

### Files deleted
- `tools/bigblocks/index.ts` — tool registration (registerBigBlocksTools)
- `tools/bigblocks/components.ts` — component registry tool
- `tools/bigblocks/docs.ts` — documentation tool
- `tools/bigblocks/examples.ts` — example code tool
- `tools/bigblocks/generator.ts` — code generation tool
- `tools/bsocial/bigblocksApiClient.ts` — API client wrapper (was unused)

### Dependencies removed from package.json
- `bigblocks`: `0.0.39` (was in `dependencies`)

### Config/code references removed
- `DISABLE_BIGBLOCKS_TOOLS` env var handling in `index.ts`
- `enableBigBlocksTools` in `ToolsConfig` interface (`tools/index.ts`)
- `loadBigBlocksTools` config property in `index.ts`
- BigBlocks entry in help text and config logging

## How to re-add

1. Add `bigblocks` back to `dependencies` in `package.json`
2. Restore `tools/bigblocks/` directory with registration, components, docs, examples, generator files
3. Add `enableBigBlocksTools` back to `ToolsConfig` interface in `tools/index.ts`
4. Add `registerBigBlocksTools` import and call in `tools/index.ts`
5. Add `DISABLE_BIGBLOCKS_TOOLS` env var handling in `index.ts` CONFIG object
6. Add config logging lines back to `index.ts`

## Git reference
The files can be recovered from git history. Last commit with BigBlocks: check `git log --all -- tools/bigblocks/` for the exact SHA.

## Why it was removed
- BigBlocks was already disabled (commented out) due to Turbopack module resolution issues
- The `bigblocks` npm package pulled in heavy React/UI dependencies that bloated the MCP server install
- Plugin users in Claude Desktop were timing out during cold start because of the large dependency tree
