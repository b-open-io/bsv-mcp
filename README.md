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

# Codex: project-bound Vault roles
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
Older installed Codex clients may require the explicit compatibility setting;
this does not constitute modern client acceptance.

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
server when you need to switch between them. The hosted plugin is a third path:
it does not read a wallet on your computer.

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

## Preparing a release package

Run `bun run pack:release /tmp` to build and create the release tarball. Install
or publish that tarball, for example `bun publish /tmp/bsv-mcp-0.5.0.tgz`,
after completing the release checks and selecting the release version.
Do not publish directly from the checkout: its manifest contains Bun patches
needed to build the wallet fixes, which fail to resolve in consumer projects.
The release command stages a separate manifest without build scripts, development
dependencies, or patch declarations; the compiled bundle includes the wallet fixes.
The destination directory must already exist.
