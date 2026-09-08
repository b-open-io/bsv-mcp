# MCP client protocol support

BSV MCP uses the split TypeScript SDK v2 packages and makes protocol
`2026-07-28` primary. Both embedded and external wallet modes support modern
tool execution. A client must negotiate the modern revision; merely installing
a v2 package does not change a client's default handshake.

## Connections

| Endpoint | Modern connection | Legacy connection (enabled by default) |
| --- | --- | --- |
| Local stdio | Modern `serveStdio`; stdout contains only MCP messages. | Supported 2025 handshakes negotiate automatically. |
| Local HTTP `/mcp` | Stateless modern requests with protocol metadata; no session ID. | Sessionful 2025 Streamable HTTP. |
| Hosted root or `/api/mcp` | Stateless modern public reads with OAuth. | Stateless 2025 POST requests. |

Set `MCP_LEGACY_COMPATIBILITY=false` to require modern clients.

The hosted route does not expose wallet mutations or local keys. Local HTTP
and hosted HTTP have different legacy session contracts. CORS preflight and
OAuth discovery are separate from MCP method execution.

Use automatic negotiation in a split SDK client:

```ts
import { Client } from "@modelcontextprotocol/client";

const client = new Client(
  { name: "example", version: "1" },
  {
    versionNegotiation: { mode: "auto" },
    capabilities: { elicitation: { form: {} } },
  },
);
```

An application must implement a human approval handler for form elicitation.
Do not auto-accept spending requests. A client lacking that capability cannot
approve embedded spending. External signer permissions remain in the provider.

## Modern HTTP metadata

The SDK supplies these headers. Preserve them through proxies and CORS:

- `Mcp-Protocol-Version: 2026-07-28`
- `Mcp-Method` matching the JSON-RPC method
- `Mcp-Name` matching named operations such as `tools/call`
- `Content-Type: application/json`

Modern requests carry a per-request metadata envelope, with no
`Mcp-Session-Id`. Missing or contradictory metadata is rejected. Authentication
inside tool handlers is available at `ctx.http?.authInfo`.

## Approvals and operation lifetime

Modern approval uses SDK input-required continuations. The server retains the
original operation and signs its continuation state, binding the authenticated
principal, scopes, method, tool name, arguments, expiry, and approval round.
Resuming supplies a decision to that operation instead of invoking the tool
again. Changed arguments, another user, forged state, expired state, and replay
are rejected. Multi-round approvals keep the original callback alive.

Decline, cancellation, wallet-session revocation, and shutdown reject pending
approvals. Legacy compatibility requests use their own request-scoped channel;
there is no fallback to another client's approval connection. Transport errors
after submitting a transaction do not cause an automatic write retry.

## Wallet roles

Embedded project sessions open every assigned role and pin its public key.
Direct, BRC-42, BRC-157, and Yours selections are checked before initializing
the wallet. Binding changes and expiry revoke retained wallet handles.
External roles use independent signer RPC endpoints and optional public-key
pins; project root/ID pairs produce separate default permission origins.

The BRC-100 tools expose an optional `walletRole` selector. Signing and
certificates default to identity; encryption/HMAC use encryption; payments and
asset operations use their corresponding roles. Known action references retain
their originating role and user. Unassigned roles fail explicitly. See
[external signer setup](external-signer.md) and [wallet accounts](keys.md).

BAP identity publication, rotation, attestations, and profile operations use the
selected identity wallet's BRC-100 derivations and signing. The identity wallet
funds its BAP transactions and retains the `bap` basket. Signed BSocial posts use
that identity; SIGMA inscriptions can use separate identity and ordinals roles.

## Catalogs

The full catalog is the default. Its tools depend on configured capabilities;
the checked-in manifest represents one synthetic configuration, not every
wallet mode. `MCP_TOOL_CATALOG=compact` selects bounded families and omits
MCP App aliases:

| Family | Operations |
| --- | --- |
| `bsv_read` | `bsv_getPrice`, `bsv_decodeTransaction`, `bsv_explore`, `bsv_status` |
| `ordinals_read` | `ordinals_getInscription`, `ordinals_searchInscriptions`, `ordinals_marketListings`, `ordinals_marketSales`, `ordinals_getTokenByIdOrTicker` |
| `wallet_read` | `wallet_getAddress`, `wallet_getBalance`, `wallet_getOrdinals`, `wallet_listTokens`, `wallet_getBsv21Balances`, `wallet_getLockData`, `wallet_getHeight`, `wallet_getHeaderForHeight`, `wallet_getNetwork`, `wallet_getVersion`, `wallet_getPublicKey`, `wallet_isAuthenticated`, `wallet_waitForAuthentication` |
| `utility` | `utils_convertData`, `utils_find_skills` |

Eligible sessions also expose mutating `wallet_setup` and `wallet_payments`
families. Modern requests can execute these through the same approval adapter.
Compact mode is intentionally a bounded subset; use full mode for identity and
asset workflows outside those families.

## MCP Apps and dependencies

The local MCP Apps adapter calls native SDK v2 registration methods and
preserves schemas, validation, structured results, resources, and UI metadata.
`@modelcontextprotocol/ext-apps@1.7.5` supplies browser behavior and constants;
its declared v1 SDK peer remains installed. This does not make ext-apps itself
v2-native, and that peer does not serve legacy server connections.

The dashboard reads complete payment balances and the configured deposit
prefix. Browser sweeps keep source keys in the browser, verify source BEEF,
preserve ordinal positions and token amounts, validate signatures, and retain
references bound to the user and selected wallet. Completed submissions cannot
be replayed through a fresh HTTP request.

## Validation scope

Checked-in tests cover actual modern stdio negotiation, authenticated local
HTTP, malformed envelopes, default legacy compatibility and explicit modern-only mode, request-scoped approval settlement,
real WalletPermissionsManager decisions, Vault derivations, external signer
HTTP crypto, BAP/AIP verification, and browser sweep signature validation.
These include synthetic transactions and keys; passing them does not imply a
live network transaction was broadcast.

The installed desktop connection was observed using legacy requests after a
restart, without protocol overrides. This verifies compatibility with that
client; it does not demonstrate modern negotiation by the desktop app.

Deployed hosted traffic and browser-host iframe/postMessage/CSP behavior must
also be checked in their actual environments. An installed Codex client that
only negotiates 2025 can validate the compatibility path but cannot establish
modern Codex acceptance. Use a modern-capable client for modern acceptance.

Official references: [SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/),
[2026-07-28 support](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28.html),
and [legacy clients](https://ts.sdk.modelcontextprotocol.io/v2/serving/legacy-clients.html).
