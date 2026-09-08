# MCP client protocol support

Status: unreleased migration documentation. This page describes the staged
implementation and its compatibility boundaries; it is not a deployment or
full test certification.

The unreleased integration migrates BSV MCP's server, client, transport,
handler, and registration boundaries to the split MCP TypeScript SDK v2
packages. The SDK/API migration and the MCP wire protocol revision are
separate decisions. Existing clients continue to use an ordinary 2025 handshake
by default; the server negotiates a supported 2025 protocol date with each
client. Protocol revision `2026-07-28` is available only when a client
explicitly negotiates it and the selected transport enables it.

## Dependency boundary

The staged integration resolves `@modelcontextprotocol/server`,
`@modelcontextprotocol/client`, and `@modelcontextprotocol/core` at `2.0.0`,
with `mcp-handler` at `2.1.1`. It keeps
`@modelcontextprotocol/sdk` at `^1.30.0` because
`@modelcontextprotocol/ext-apps` at `^1.7.5` declares it as a v1 peer. The
local MCP Apps adapter uses native SDK v2 registration methods; ext-apps remains
for shared constants and its browser `App` implementation. This mixed graph is
intentional, and it is not a claim that ext-apps 1.7.5 is v2-native or that the
retained v1 package serves legacy wire clients.

## Connection posture

| Connection | 2025-compatible behavior | Modern opt-in behavior |
| --- | --- | --- |
| Local stdio (`bunx bsv-mcp@latest --stdio`) | `serveStdio` serves the 2025 handshake by default. JSON-RPC stays on stdout; startup and diagnostics go to stderr. | A v2 client can explicitly negotiate `2026-07-28` when the server advertises it. This is a protocol choice made by the client, not an automatic result of installing v2 packages. |
| Local HTTP (`/mcp`) | The existing Streamable HTTP path is sessionful: initialize creates an `mcp-session-id`, follow-up requests use it, and the 2025 path handles session stream/cleanup operations. | Requests with a modern envelope are routed to a stateless v2 handler without an MCP session ID. The direct Bun routing matrix still needs end-to-end release validation. |
| Hosted HTTP (`https://bsvmcp.com` or `/api/mcp`) | The v2 `mcp-handler` provides a stateless 2025 fallback for POST requests. The bounded adapter proof returned 405 for direct GET, DELETE, and OPTIONS calls; do not rely on the old GET-based SSE or session-deletion contract. | Send a modern JSON request with the required protocol metadata headers. The root URL is rewritten to `/api/mcp` for MCP-shaped requests; OAuth discovery and protected-resource metadata remain separate HTTP endpoints. Production route behavior is still pending deployment validation. |

The local and hosted HTTP contracts are intentionally different at this stage:
local Bun HTTP preserves 2025 sessions, while the v2 hosted adapter is
stateless. Clients should use the endpoint configured for their deployment and
should not infer session support from the presence of Streamable HTTP in the
product description.

## Modern HTTP requests

A client opting into `2026-07-28` must preserve the protocol metadata through
any proxy and CORS layer:

- `Mcp-Protocol-Version: 2026-07-28`
- `Mcp-Method` naming the MCP operation
- `Mcp-Name` for named operations such as `tools/call`, matching the request
  body
- `Content-Type: application/json` (parameters such as `charset=utf-8` are
  accepted)
- no `Mcp-Session-Id`; modern requests carry their per-request envelope

The v2 adapter proof covered modern discovery, `tools/list`, and an
authenticated `tools/call` in a scratch harness. That proof does not establish
that every production tool, wallet mode, or deployed proxy handles the modern
envelope. Missing or mismatched method metadata should be treated as a protocol
error rather than falling through to the website.

## Legacy clients and authentication

The 2025 stdio path remains the compatibility default. 2025 hosted clients
should use the documented hosted URL and bearer OAuth flow; the hosted route
continues to expose the existing protected-resource metadata contract. In v2
tool handlers, request authentication is available under
`ctx.http?.authInfo`; this is the replacement for reading authentication from
the v1 handler `extra` object.

The old `@modelcontextprotocol/sdk` package remains in the staged dependency
graph because `@modelcontextprotocol/ext-apps@1.7.5` declares an SDK v1 peer.
It is retained for that ext-apps dependency, not to serve 2025 wire clients:
SDK v2 `serveStdio` and the v2-exported compatibility transport serve the
2025-compatible connections. The local adapter keeps the v1 peer from crossing
the native v2 server types, and its bounded registration tests cover that
isolation. Remove the old package after ext-apps is v2-compatible and its
remaining v1 consumers have been migrated.

## MCP Apps

MCP Apps server registration uses a local native SDK v2 adapter. It delegates to
`server.registerTool` and `server.registerResource`, preserving v2 schema
conversion and request validation, and normalizes nested `_meta.ui.resourceUri`
with the legacy `ui/resourceUri` metadata key. ext-apps 1.7.5 remains for shared
constants and the browser `App` implementation, with its SDK v1 peer retained.
This does not make ext-apps 1.7.5 v2-native: its declarations and runtime still
import the v1 SDK package.

Checked-in `utils/mcpAppRegistration.test.ts` covers native v2 schema and
metadata normalization plus the resource MIME type. `tests/mcp-apps.test.ts`
covers v2 `tools/list`, `tools/call` structured results, and
`resources/list`/`resources/read` HTML. The two files pass together in the
current integration worktree.

No browser-host integration proof is recorded here for iframe loading,
postMessage origins, CSP, or the complete `ui/initialize` exchange. Keep the
existing pre-connect event-handler ordering when this gate is closed.

## Tools and wallet behavior

The checked-in [tool manifest](../lib/tool-manifest.json) is the full-profile
catalog source for one synthetic server configuration. It is a baseline, not a
promise of a fixed default count or of one tool set for every installation.
Wallet mode, enabled modules, account context, and the selected profile can
change the tools returned by `tools/list`; the full profile remains the default.

`MCP_TOOL_CATALOG=compact` is an explicit opt-in profile. It groups reviewed
read operations into bounded families and omits the MCP App tools from that
profile; the capability is staged and remains subject to release validation.
Each family accepts only one of its enumerated operations and that operation's
arguments:

| Family | Operations |
| --- | --- |
| `bsv_read` | `bsv_getPrice`, `bsv_decodeTransaction`, `bsv_explore`, `bsv_status` |
| `ordinals_read` | `ordinals_getInscription`, `ordinals_searchInscriptions`, `ordinals_marketListings`, `ordinals_marketSales`, `ordinals_getTokenByIdOrTicker` |
| `wallet_read` | `wallet_getAddress`, `wallet_getBalance`, `wallet_getOrdinals`, `wallet_listTokens`, `wallet_getBsv21Balances`, `wallet_getLockData`, `wallet_getHeight`, `wallet_getHeaderForHeight`, `wallet_getNetwork`, `wallet_getVersion`, `wallet_getPublicKey`, `wallet_isAuthenticated`, `wallet_waitForAuthentication` |
| `utility` | `utils_convertData`, `utils_find_skills` |

Local setup and PeerPay receiving use separate `wallet_setup` and
`wallet_payments` families when available. Both carry mutating annotations and
remain unavailable for modern requests.

Wallet operations are filtered when the selected wallet context cannot support
them. The manifest and catalog tests should verify stable schemas,
deterministic family names, and one legacy implementation for each compact
operation.

The modern transport proof covers protocol exchange, not wallet spending.
Modern discovery and tool transport are available. Approval-dependent modern
mutations remain unsupported pending approved request-scoped adapters. The
central guard now rejects those requests before their callbacks run, and
policy/wire tests cover that denial. Codex v0.153.4 acceptance verified a wire
initialize selecting `2025-06-18`, `tools/list`, and a dashboard `tools/call`
returning `ready: true`; modern Codex acceptance remains unverified because the
installed client selects a 2025 protocol. The intended modern read scope is
limited to reviewed, allowlisted read-only calls. Use a supported 2025
connection with form elicitation for the approval flow; successful modern
approval and write settlement are future support work.

## Release gates

The migration is ready for a versioned release only after these checks are
complete:

- a real stdio subprocess completes a 2025 initialize, `tools/list`, and a
  representative call with clean stdout;
- the full configured `tools/list` schema bytes are valid and stable, and the
  sorted names remain in sync with the checked-in manifest for that synthetic
  configuration;
- compact mode remains explicit opt-in and is tested for bounded read families,
  stable schemas, deterministic results, and no MCP App aliases;
- local 2025 session routing and modern stateless routing are tested through
  the Bun endpoint, including malformed metadata, CORS preflight, session
  cleanup, and authenticated principal binding;
- the deployed hosted route is tested for OAuth, CORS, protected-resource
  metadata, 2025 fallback, modern headers, and its POST-only method contract;
- Codex v0.153.4 acceptance verifies a wire initialize selecting `2025-06-18`,
  `tools/list`, and a dashboard `tools/call` returning `ready: true`; modern
  Codex acceptance remains a release gate until an installed client negotiates
  the modern revision;
- the ext-apps peer/adapter and browser-host gates pass; and
- modern approval-dependent mutations are centrally refused, with tests
  demonstrating refusal, no fallback to another client or session, legacy
  approval isolation, decline/cancel/disconnect handling, and exactly-once
  denial.

Successful modern request-scoped approval exchange and write settlement are a
future support gate. They should be added only after an approved modern
approval adapter is implemented and tested.

The bounded SDK v2 stdio, hosted, tool API, MCP Apps, and compact catalog proofs
are evidence for API shapes and scratch behavior only. They do not certify
this repository's full dependency graph, Bun/Next/Vite builds, production
deployment, browser host, wallet operations, or secrets.

For the official protocol and SDK references, see the [MCP TypeScript SDK v2
documentation](https://ts.sdk.modelcontextprotocol.io/v2/), the [2026-07-28
support guide](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28.html),
and the [legacy client guidance](https://ts.sdk.modelcontextprotocol.io/v2/serving/legacy-clients.html).
