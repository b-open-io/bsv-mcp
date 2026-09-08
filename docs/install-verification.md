# Install verification — 2026-09-08

Verified the current checkout's finished consumer tarball, built by `bun run pack:release /tmp`, in a fresh directory under `/tmp`. The tarball retains version 0.4.0 because npm release preparation was paused; it is the current local build, not a claim that npm's existing 0.4.0 contains these changes. Bun installed 257 packages without a missing checkout-patch error.

| Harness | Check | Result |
| --- | --- | --- |
| Grok Build | `mcp add --scope project`, then `mcp doctor` with the test directory trusted | Server started; MCP 2025-11-25 handshake; 23 tools discovered |
| Claude Code | Explicit MCP config pointing to the installed tarball entrypoint | Model confirmed available BSV tools; no BSV tools invoked |
| Codex CLI 0.153.4 | Isolated config pointing to the installed tarball entrypoint; deferred tool discovery | Found `bsv_status`, `bsv_explore`, and `bsv_decodeTransaction`; no wallet actions |
| Grok plugin | Installed the local repository, then ran `mcp doctor` | Plugin root expanded correctly; bundled server started; 23 tools discovered |
| Claude plugin | Loaded local plugin directory in a session | BSV tools exposed; no BSV tools invoked |

The temporary Grok plugin installation was removed after verification. No npm package was published.

## Corrections

- Grok supports Claude-format plugins. The homepage now uses `grok plugin install b-open-io/bsv-mcp`.
- Grok's CLI does create `.grok/config.toml` with `[mcp_servers.NAME]`; that file exists, but manual TOML configuration is unnecessary for the plugin route.
- Claude's instructions now register the `b-open-io/claude-plugins` marketplace before installing the plugin.
- The shared Claude/Grok `.mcp.json` now launches the bundled local server. It previously pointed to the hosted OAuth endpoint, contradicting the local-wallet instructions.
- The Codex app's existing hosted plugin connection is explicitly retained in `.codex-plugin/mcp.json`. The homepage's Codex CLI command continues to register the local npm package.

Official references: https://docs.x.ai/build/features/skills-plugins-marketplaces and https://docs.x.ai/build/features/mcp-servers. Published Git/plugin installation still depends on shipping the verified checkout; the checks above use the local finished artifact.

## Release candidate 0.5.0

The final 0.5.0 tarball was installed in a new consumer directory on 2026-09-08: 257 packages installed successfully. Its bundled server negotiated both 2025-11-25 and 2026-07-28, listed 25 tools and three resources with wallet tools disabled, and returned the dashboard successfully. The source suite passed 718 tests with 3,945 assertions; TypeScript and `git diff --check` passed.

Production OAuth acceptance found a blocking provider issue: native dynamic client registration returns HTTP 500 because Sigma auth's `oauthClient.ownerBapId` column is NOT NULL. The provider advertises anonymous dynamic registration, whose inserts have no owner identity. Production logs confirmed SQLSTATE 23502 on 2026-09-08. Fresh OAuth login, refresh, and authenticated hosted tool acceptance remain incomplete until the provider is repaired.
