# BSV MCP

BSV MCP connects your AI assistant to Bitcoin SV. Ask it to check a transaction, show your balance, send a payment, or create and trade ordinals (content recorded on the blockchain).

[Documentation](https://bsvmcp.com/docs) · [All tools](https://bsvmcp.com/docs/tools) · [npm](https://www.npmjs.com/package/bsv-mcp) · [Issues](https://github.com/b-open-io/bsv-mcp/issues)

## Install

Install [Bun](https://bun.sh) to run the server and Node.js for the `npx` commands below, then add it to your client:

```sh
# Codex
codex mcp add bsv-mcp -- npx -y bsv-mcp@latest --stdio

# Claude Code
claude mcp add --transport stdio bsv-mcp -- npx -y bsv-mcp@latest --stdio
```

Choose one command. For Cursor or Claude Desktop, use this server configuration:

```json
{
  "mcpServers": {
    "bsv-mcp": {
      "command": "npx",
      "args": ["-y", "bsv-mcp@latest", "--stdio"]
    }
  }
}
```

Restart your client, then ask: **“Run bsv_status and explain what is available.”**
Local stdio needs no Sigma account or OAuth sign-in. It is also the default when
no transport is specified. Existing self-hosted HTTP remains opt-in through
`TRANSPORT=http`; the deployed hosted endpoint is unchanged.

For the Codex desktop plugin, add `b-open-io/claude-plugins` in the plugin
marketplace and install **BSV MCP**. The plugin starts the local npm executable
and requires Node.js and Bun. Claude Code and Grok plugins bundle the local server and
require Bun. Choose one registration to avoid duplicate tools.

## Connect a wallet

Ask your assistant to run `wallet_onboarding`. Create, import or unlock a Vault
in the local browser. Back it up before funding. Enter passwords only in the
local setup UI, never in chat. After a server restart, unlock it again.

To use an existing BRC-100 wallet, configure its signing API instead:

```json
{
  "mcpServers": {
    "bsv-mcp": {
      "command": "npx",
      "args": ["-y", "bsv-mcp@latest", "--stdio"],
      "env": {
        "BRC100_WALLET_URL": "http://127.0.0.1:3321",
        "BRC100_WALLET_ORIGINATOR": "bsv-mcp.local"
      }
    }
  }
}
```

The wallet keeps its keys and controls permission requests. Its signing API is
separate from a wallet-storage endpoint. See [wallet setup](https://bsvmcp.com/docs#wallets)
for network settings, account selection and project roles.

The package also includes the Bun-based `bsv-mcp-local` launcher for explicit external,
legacy embedded and project configurations. Source-checkout examples live in
[the installation guide](docs/install-verification.md).

## MCP protocol compatibility

Protocol revision `2026-07-28` is preferred, with supported 2025 clients
accepted automatically on stdio and HTTP. No compatibility override is needed.
Set `MCP_LEGACY_COMPATIBILITY=false` only to require modern clients. This
setting also passes through the local launcher. The installed desktop client
was verified using legacy requests; modern support is tested separately.

Modern clients support wallet operations and request-scoped approval. Approval
continuations retain the original operation and bind to its authenticated user,
arguments, and expiry. Decline, cancellation, or session revocation stops the
operation; replaying a continuation does not repeat a transaction. A client
without form elicitation cannot approve a spend. External wallets retain their
own signer permission flow. The hosted route exposes public reads only.

For the split SDK v2 client:

```ts
const client = new Client(
  { name: "my-app", version: "1" },
  { versionNegotiation: { mode: "auto" }, capabilities: { elicitation: { form: {} } } },
);
```

Register a real human approval handler before using approval-dependent tools.
Legacy protocol compatibility is enabled by default; the connected client must support the approval flow needed by the requested tool.

The full tool catalog remains the default and is capability-derived: wallet
mode, enabled modules, account context, and the selected profile determine what
`tools/list` returns. The checked-in manifest is a synthetic baseline for one
configured server, not a promise of a fixed default count. Set
`MCP_TOOL_CATALOG=compact` only to opt into bounded read families; compact mode
uses the same underlying handlers. Tool availability still
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
Project mode opens every explicitly assigned role: `payments`,
`identity-signing`, `one-sat`, and `encryption`. It requires paired project
selectors and `BSV_MCP_PASSWORD` at runtime; set `VAULT_PATH` when the Vault
module does not provide a default path. Bindings pin the selected public key
and support direct keys, BRC-42 children, and BRC-157/Yours profile leaves.
Changing the project binding or expiring its session revokes captured handles.
Derived keys have separate storage; selecting the account's payment root keeps
its existing database and deposit prefix.

BRC-100 tools accept `walletRole` (`payments`, `identity`, `ordinals`, or
`encryption`). Method defaults select the matching role, and sign/abort action
continuations retain their originating wallet and authenticated user. An
unassigned role fails rather than borrowing another key. BAP tools use the
identity wallet for publication, rotation, attestations, and profiles without
exporting an xprv. That wallet also funds those transactions and retains BAP
records. Signed BSocial posts and SIGMA inscriptions use the configured identity.

External registrations can use the same project root/ID pair to derive an
isolated permission origin, without a Vault password. Optional
`BRC100_WALLET_PUBLIC_KEY` pins the signer identity. `BRC100_WALLET_ROLES` is a
JSON object selecting independent role endpoints and public-key pins; see
[external signer configuration](docs/external-signer.md). The source launcher
accepts `external --project-root /absolute/project --project-id project.example`.
It defaults to disabled broadcasting; set `DISABLE_BROADCASTING=false` in its
runtime environment to enable transaction tools with the signer's approval.

Each mode has its own process environment and should be registered as a separate
server when you need to switch between them. Use only the registrations needed by the project.

Embedded wallets can list pending PeerPay payments and receive a selected
payment with `wallet_peerPayments`. Receiving requires a message ID and
acknowledges the message only after the wallet accepts it. These operations do
not pay MessageBox service fees. External signers and Droplit do not expose this tool. Project sessions require
an assigned payment role.

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
- [Tools and workflows](https://bsvmcp.com/docs/tools)
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

## Preparing a release package

Run `bun run pack:release /tmp` to build and create the release tarball. Install
or publish that tarball, for example `bun publish /tmp/bsv-mcp-0.5.1.tgz`,
after completing the release checks and selecting the release version.
Do not publish directly from the checkout: its manifest contains Bun patches
needed to build the wallet fixes, which fail to resolve in consumer projects.
The release command stages a separate manifest without build scripts, development
dependencies, or patch declarations; the compiled bundle includes the wallet fixes.
The destination directory must already exist.
