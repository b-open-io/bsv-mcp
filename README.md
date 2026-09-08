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

Install [Bun](https://bun.sh), clone this repository, and build the local
server. The local wallet registrations below use the source checkout's launcher;
`scripts/local-mcp-launcher.ts` is not included in the npm package.

```sh
git clone https://github.com/b-open-io/bsv-mcp.git
cd bsv-mcp
bun install
bun run build
```

For legacy embedded mode, create an encrypted account in a local terminal. The
source-checkout launcher can open it after creation:

```sh
bun run index.ts init --account default
```

For a new local Vault, or to import an existing wallet through the private
browser setup, register the built server directly:

```sh
# Codex: local Vault setup and unlock
codex mcp add bsv-mcp-vault \
  -- bun --no-env-file /absolute/path/to/bsv-mcp/dist/index.js --stdio
```

If the server reports that wallet setup is needed, ask your agent to run
`wallet_onboarding`, then create, import, or unlock the wallet in the browser.

Choose one explicit local wallet mode when registering the server:

```sh
# Codex: existing BRC-100 signer
codex mcp add bsv-mcp-external \
  --env BRC100_WALLET_URL=https://signer.example/rpc \
  --env BRC100_WALLET_ORIGINATOR=bsv-mcp.local \
  -- bun --no-env-file /absolute/path/to/bsv-mcp/scripts/local-mcp-launcher.ts external

# Codex: existing encrypted local account (legacy account path)
codex mcp add bsv-mcp-embedded \
  --env BSV_MCP_ACCOUNT=default \
  -- bun --no-env-file /absolute/path/to/bsv-mcp/scripts/local-mcp-launcher.ts embedded

# Codex: project-bound Vault payments role
codex mcp add bsv-mcp-project \
  -- bun --no-env-file /absolute/path/to/bsv-mcp/scripts/local-mcp-launcher.ts project \
  --project-root /absolute/path/to/project --project-id project.example
```

Claude Code uses the same launcher and can register either mode with
`claude mcp add --transport stdio`, for example:

```sh
claude mcp add --transport stdio bsv-mcp-external \
  --env BRC100_WALLET_URL=https://signer.example/rpc \
  --env BRC100_WALLET_ORIGINATOR=bsv-mcp.local \
  -- bun --no-env-file /absolute/path/to/bsv-mcp/scripts/local-mcp-launcher.ts external
```

Set `BSV_MCP_PASSWORD` in the MCP host's runtime environment for the launcher's
existing-account embedded mode and for project mode. The direct Vault setup
registration above collects its password in the local browser instead.
Do not put that password in the registration command or saved MCP configuration.
The launcher passes it to the child only at runtime, never through argv or its
diagnostics. `BRC100_WALLET_URL` and `BRC100_WALLET_ORIGINATOR` are read at
runtime for external mode. Claude Code uses the same launcher command with
`claude mcp add --transport stdio` and its `--env` options for non-secret values.

The launcher starts the checked-out `dist/index.js` with `--no-env-file`, an
explicit mode, and a working directory outside the checkout. Its embedded mode
requires an existing encrypted account; it does not create or migrate one. Use
the direct server registration above when the browser setup must create or
import a local Vault wallet.

Or install the Claude Code plugin from the b-open-io marketplace for hosted MCP:

```sh
claude plugin install bsv-mcp@b-open-io
```

For another local client, register the same launcher command for external or
legacy embedded mode, or register `bun --no-env-file .../dist/index.js --stdio`
for browser-based Vault setup. For hosted access, connect to
**https://bsvmcp.com**. See [client setup](https://bsvmcp.com/#install).

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
depends on wallet mode and enabled modules. Its baseline read families are
`bsv_read`, `ordinals_read`, `wallet_read`, and `utility`, each with a bounded
operation enum; unknown operations are rejected. Eligible sessions also expose
separate mutating `wallet_setup` and `wallet_payments` families. See the [MCP client
protocol support guide](docs/mcp-client-protocol-support.md) for the per-family
operation bounds, endpoint contracts, MCP Apps compatibility, and validation
status.

## Local wallet modes

External mode connects to an existing BRC-100 signer. The signer keeps the
private keys, wallet storage, and permission decisions; BSV MCP receives only
the SDK signer interface. Embedded mode uses an encrypted local Vault wallet.
The wallet-ready screen displays an interactive cloud of the connected session’s
available tools, generated from its live catalog.

When setup is needed, `wallet_onboarding` opens the private browser flow to
create, import, or unlock it. The selected account's database and storage
configuration remain in use. The launcher's existing-account embedded mode
still supplies `BSV_MCP_PASSWORD` at runtime.
Project mode opens only the explicitly assigned `payments` role from the
project's local Vault bindings. It requires paired project selectors and
`BSV_MCP_PASSWORD` at runtime; set `VAULT_PATH` when the installed Vault module
does not provide a default path. Identity, encryption, and OneSat asset roles
are not exposed by this initial payments-only surface.

Each mode has its own process environment and should be registered as a separate
server when you need to switch between them. The hosted plugin is a third path:
it does not read a wallet on your computer.

Embedded wallets can list pending PeerPay payments and receive a selected
payment with `wallet_peerPayments`. Receiving requires a message ID and
acknowledges the message only after the wallet accepts it. These operations do
not pay MessageBox service fees. External signers, Droplit, and project
payments-only sessions do not expose this tool.

## Find a skill

Use `utils_find_skills` with a short keyword query to find skills in the bOpen
catalog. It returns up to five descriptions and links to versioned `SKILL.md`
files. It does not download skill contents or install plugins. In compact mode,
select `utils_find_skills` from the `utility` tool.

The static tutorial prompts and BRC/BitCom resource catalog have been retired.
Use the skill finder for those references. Changelog, JungleBus documentation,
and the dashboard app resource remain available.

## Bring your wallet and infrastructure

Connect a compatible existing wallet with `BRC100_WALLET_URL`, select a legacy
encrypted account with `BSV_MCP_ACCOUNT` and unlock it with
`BSV_MCP_PASSWORD`, or use the local Vault browser setup. If setup is needed,
ask your agent to run `wallet_onboarding`; after a restart, run it again to
unlock the saved Vault. Startup never creates keys. An existing wallet keeps
its keys and controls permissions. `PRIVATE_KEY_WIF` and `IDENTITY_KEY_WIF` are
legacy compatibility inputs; they trigger a persistent Vault migration warning
and should be removed after importing the keys into Vault. See the wallet setup
guide for the required wallet API and configuration.

The default 1Sat API backend is `https://api.1sat.app`. New mainnet embedded
accounts use `https://wallet.1sat.app` for wallet storage by default; testnet
accounts do not select a remote storage provider unless configured. Override
`ONESAT_API_URL` for API services and `REMOTE_STORAGE_URL` for wallet storage;
these are separate settings. Available tools depend on wallet mode and enabled
modules.

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
# Supply BRC100_WALLET_URL in the host environment before this launch.
bun --no-env-file scripts/local-mcp-launcher.ts external # Source-checkout local launch
bun test
```

Experimental software; APIs may change. Keep a wallet backup. If a transaction request times out, check whether it succeeded before sending it again. MIT licensed.
