# Wallet accounts

Each account owns one directory:

```text
~/.bsv-mcp/accounts/<name>/
  config.json
  keys.bep
  wallet-main.db       # or wallet-test.db
```

`config.json` records the network, storage identity and optional `activeRemote` and `backups` URLs. New mainnet accounts default to `https://wallet.1sat.app` for wallet storage; testnet accounts have no remote storage by default. `keys.bep` contains the encrypted payment key and any legacy identity keys. The SQLite database records wallet transactions and derived outputs. Back up all three; a root key alone is not a complete wallet backup. The wallet may also create SQLite sidecars, task state and an audit log in the same directory.

`REMOTE_STORAGE_URL` is a runtime override for the active wallet-storage URL.
`ONESAT_API_URL` configures the 1Sat API services and does not select wallet
storage. Storage URLs must be HTTPS or loopback HTTP and cannot contain
credentials, queries, or fragments.

Directories use mode 0700 and new files use 0600. Account names contain lowercase letters, digits, underscores or hyphens. Agents must never create wallet directories outside `~/.bsv-mcp`.

## Set up an account

Run this yourself in a local terminal:

```sh
bunx bsv-mcp@latest init --account default
```

Choose the network and whether to generate or import a key. Enter the encryption password twice. WIF imports are hidden. The command reports only the public address; it never prints a private key. Back up the encrypted files and keep the password separately before funding the wallet.

For headless use, supply `BSV_MCP_PASSWORD` through the MCP host's runtime
environment and select `BSV_MCP_ACCOUNT` (default: `default`). When using the
source-checkout launcher, register `scripts/local-mcp-launcher.ts embedded` and
keep the password out of its command line and saved MCP configuration. The
launcher checks that the named account already has `config.json` and encrypted
`keys.bep`; it never creates or migrates an account. Do not put secrets in chat,
command arguments, or committed configuration.

Key resolution is explicit: `BRC100_WALLET_URL` selects an external signer and rejects conflicting local key variables. Otherwise `PRIVATE_KEY_WIF` takes precedence over the selected encrypted account as a legacy compatibility input. Its use prints a persistent Vault migration warning; move the key into Vault and remove both WIF environment variables. A bad key or password stops startup. There is no plaintext fallback and no automatic generation. Read-only operation is available with `DISABLE_WALLET_TOOLS=true`.

## Manage accounts

```sh
bunx bsv-mcp@latest wallet_list
bunx bsv-mcp@latest wallet_generate --account research
bunx bsv-mcp@latest wallet_import --account existing
bunx bsv-mcp@latest wallet_use --account research
```

`wallet_list` returns account names, networks, public addresses and encrypted-file status. It does not unlock accounts or query balances. `wallet_use` gives the environment setting to apply; restart your MCP server to switch accounts.

The MCP tools use the same names. Generation and encrypted-backup import require a locally configured password and an affirmative human approval through the MCP client. If the client cannot ask for approval, use the terminal. Plaintext WIF import is terminal-only. No account tool returns a secret.

Removal requires `wallet_remove --account NAME --force` and confirmation that an encrypted backup of the keys and database has been verified. A single address or basket cannot prove that the wallet has no funds. The MCP tool also requires `backupConfirmed`, human approval, and refuses to remove the active account. Removal never sweeps funds.

## Migrate an existing wallet

Stop every process using the source wallet first. Migration copies the identity into encrypted storage and takes a consistent SQLite snapshot when the source database is present. It does not create a new key, send a transaction or delete the source by default.

```sh
bunx bsv-mcp@latest wallet_migrate --source legacy --account default
bunx bsv-mcp@latest wallet_migrate --source sigma-lab --account sigma-lab
```

The legacy source is `~/.bsv-mcp/keys.json`. Other wallet directories are only discovered when explicitly listed in `~/.bsv-mcp/settings.json` under `sources`. Each entry specifies a unique `name`, absolute `directory`, and `keyFile` (`keys.json` or `root.wif`). Optional `storageIdentityKey` and `depositPrefix` preserve the source wallet’s storage namespace and deposit derivation. Discovery inspects filenames without reading keys. It never scans MCP installation or test directories. The legacy CLI supports `--source one-sat --source-directory <absolute-path> --storage-identity <existing-id>` for a OneSat root-WIF/database migration; it has no default custom directory.

Verify the encrypted account and database and make a backup before rerunning with `--erase-source`. That option overwrites and removes the source plaintext file after confirmation. Overwriting cannot guarantee erasure from SSDs, APFS snapshots, backups or other copies. It does not modify experiment scripts or delete their directories. Repeating migration with the same identity does not replace the account.

Do not rerun an old script that creates a missing key. Update the MCP registration after migration to use the named account or [external signer](external-signer.md).

## Set up the local Vault

Embedded local wallets use the installed `@opl.dev/vault` module when it is
available. The encrypted Vault is stored at `VAULT_PATH` when that absolute
path is configured, or at `~/.bsv/vault.bep` by default. The selected account's
`config.json` stores a public `vaultBinding` containing the Vault and entry
identifiers and public keys; it never stores a password or private key. The
account's existing network, storage settings, and wallet database remain in
use.

When a local stdio server has no usable wallet, finds an encrypted legacy
account without a runtime password, or finds an account with a locked Vault, it
keeps public tools available and registers the `wallet_onboarding` tool. Ask
your agent to run `wallet_onboarding` to open setup on the computer running MCP.
The tool opens a private loopback browser session only when invoked; startup
does not open a browser. Passwords, key material, and the callback URL stay in
the local setup session and are not returned to the agent.

The browser setup flow can:

- create a new wallet in a new or existing encrypted Vault;
- unlock a wallet already bound to the local Vault;
- import a detected encrypted or plaintext local source, or a browsed `.bep`
  or structured `.json` key backup; and
- recover signing access for a database-only source when a matching key backup
  proves the configured address. Existing `wallet-main.db`, `wallet-test.db`,
  and `wallet.db` files are preserved, while conflicting databases or live
  SQLite sidecars stop a source import before a write.

After a successful create, import, or unlock, the wallet is activated in the
same MCP session and the tool catalog is refreshed. No registration change or
restart is needed for that session. On a later server restart, ask your agent
to run `wallet_onboarding` again and enter the Vault password to unlock the
persisted binding.

From a source checkout, run this command for standalone local setup:

```sh
bun run index.ts vault-setup
```

Without explicit project selectors, the command supports the same create,
import, and unlock flow and activates no MCP session. A paired
`BSV_MCP_PROJECT_ROOT` and `BSV_MCP_PROJECT_ID` selects the separate
project-role migration wizard instead; project mode keeps its explicit
`payments` role and does not enable identity, encryption, or OneSat asset roles
automatically. The local setup server binds to loopback and expires after five
minutes or when you stop it with Ctrl+C.

The existing `init`, `wallet_*`, and `wallet_migrate` commands remain supported
for the legacy encrypted account format. `wallet_migrate` does not write a
Vault; use browser setup to import a detected source or key backup into Vault.
`PRIVATE_KEY_WIF` and `IDENTITY_KEY_WIF` remain legacy compatibility inputs and
continue to emit a Vault migration warning. Remove them after importing the
keys into Vault.
