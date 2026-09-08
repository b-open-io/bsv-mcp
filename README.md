# BSV MCP

BSV MCP connects your AI assistant to Bitcoin SV. Ask it to check a transaction, show your balance, send a payment, or create and trade ordinals (content recorded on the blockchain).

[Documentation](https://bsvmcp.com/docs) · [Connect hosted](https://bsvmcp.com/connect) · [npm](https://www.npmjs.com/package/bsv-mcp) · [Issues](https://github.com/b-open-io/bsv-mcp/issues)

## Install in ChatGPT desktop or Codex

In Plugins, choose **Add marketplace** and enter `b-open-io/claude-plugins`.
Leave Git ref and Sparse paths blank. Select **BSV MCP** in the bOpen marketplace
and install it. Authenticate through Sigma Identity when prompted, then start a
new chat and ask: “Run bsv_status and explain which services are available.”

The plugin uses hosted MCP, so you do not need Bun or a local wallet. Signing in
does not authorize spending or connect a wallet on your computer. For wallet
operations, use the local setup below. If you already have a manual BSV MCP
connection, choose which connection to use to avoid duplicate tools.

## Quick start

Install [Bun](https://bun.sh). Set up an encrypted account with `bunx bsv-mcp@latest init`, or connect an existing signer as described in [wallet setup](https://bsvmcp.com/docs#wallets). Then register the server:

```sh
# Codex
codex mcp add bsv-mcp -- bunx bsv-mcp@latest --stdio

# Claude Code
claude mcp add --transport stdio bsv-mcp -- bunx bsv-mcp@latest --stdio
```

Or install the Claude Code plugin from the b-open-io marketplace:

```sh
claude plugin install bsv-mcp@b-open-io
```

For other clients, use `bunx bsv-mcp@latest --stdio` as the MCP server command (stdio transport). For hosted access, connect to **https://bsvmcp.com**. See [client setup](https://bsvmcp.com/#install).

Ask your agent: **“Run bsv_status, then show my wallet balance.”**

## MCP protocol compatibility

The MCP SDK v2 and protocol migration is currently unreleased. The default
connection remains an ordinary 2025 handshake, so existing stdio clients and
2025 hosted clients remain the compatibility target. The server negotiates a
supported 2025 protocol date with each client. Protocol revision
`2026-07-28` is a separate opt-in: modern HTTP clients must send the protocol,
method, and operation headers required by that revision, and do not use an MCP
session ID.
The package/API upgrade alone does not change the wire protocol selected by a
client.

Modern discovery and tool transport are available. Approval-dependent modern
mutations remain unsupported pending approved request-scoped adapters. The
central guard now rejects those requests before their callbacks run, and
policy/wire tests cover that denial. Codex v0.153.4 acceptance verified a wire
initialize selecting `2025-06-18`, `tools/list`, and a dashboard `tools/call`
returning `ready: true`; modern Codex acceptance remains unverified because the
installed client selects a 2025 protocol. The intended modern read scope is
limited to reviewed, allowlisted read-only calls. Use a supported 2025
connection with form elicitation for the approval flow.

The full tool catalog remains the default and is capability-derived: wallet
mode, enabled modules, account context, and the selected profile determine what
`tools/list` returns. The checked-in manifest is a synthetic baseline for one
configured server, not a promise of a fixed default count. Set
`MCP_TOOL_CATALOG=compact` only to opt into bounded read families; compact mode
is a staged capability pending release validation. Tool availability still
depends on wallet mode and enabled modules. Compact mode exposes only the
`bsv_read`, `ordinals_read`, `wallet_read`, and `utility` families, each with a
bounded operation enum; unknown operations are rejected. See the [MCP client
protocol support guide](docs/mcp-client-protocol-support.md) for the per-family
operation bounds, endpoint contracts, MCP Apps compatibility, and validation
status.

## Bring your wallet and infrastructure

Connect a compatible existing wallet with `BRC100_WALLET_URL`, or select an encrypted account with `BSV_MCP_ACCOUNT` and unlock it with `BSV_MCP_PASSWORD` in the process environment. Startup never creates keys. An existing wallet keeps its keys and controls permissions. `PRIVATE_KEY_WIF` and `IDENTITY_KEY_WIF` are legacy compatibility inputs; they trigger a persistent Vault migration warning and should be removed after migration. See the wallet setup guide for the required wallet API and configuration.

The default 1Sat backend is `https://api.1sat.app`. Override `ONESAT_API_URL` to use a compatible deployment; configure wallet storage, explorer, content, and legacy services separately. Available tools depend on wallet mode and enabled modules.

- [Wallet setup](https://bsvmcp.com/docs#wallets)
- [Backend configuration](https://bsvmcp.com/docs#backends)
- [Tools and workflows](https://bsvmcp.com/docs#tools)
- [Paid service requests](https://bsvmcp.com/docs#x402)
- [Sponsorship](https://bsvmcp.com/docs#sponsorship) and [agent delegation](https://bsvmcp.com/docs#delegation)
- [Troubleshooting and development](https://bsvmcp.com/docs#troubleshooting)

## Development

```sh
bun install
bun run dev          # Website
bun run build:all    # MCP server and dashboard
bun dist/index.js --stdio # Local stdio launch; npm publication is not required
bun test
```

Experimental software; APIs may change. Keep a wallet backup. If a transaction request times out, check whether it succeeded before sending it again. MIT licensed.
