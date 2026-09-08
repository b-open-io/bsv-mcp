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

The legacy source is `~/.bsv-mcp/keys.json`. The lab source is `~/.local/share/sigma-brc169-lab/root.wif` and `wallet.db`. The lab migration preserves `storageIdentityKey: sigma-brc169-lab` and the `1sat` deposit prefix. Legacy migration preserves `storageIdentityKey: bsv-mcp` and uses the configured 1Sat API base URL followed by `/1sat/wallet` for active storage, which is `https://api.1sat.app/1sat/wallet` by default; `REMOTE_STORAGE_URL` can override it during migration. This legacy fallback is separate from the `https://wallet.1sat.app` default for newly-created mainnet accounts. A legacy database stored elsewhere must be preserved separately before adopting the account; the migration does not guess its location.

Verify the encrypted account and database and make a backup before rerunning with `--erase-source`. That option overwrites and removes the source plaintext file after confirmation. Overwriting cannot guarantee erasure from SSDs, APFS snapshots, backups or other copies. It does not modify experiment scripts or delete their directories. Repeating migration with the same identity does not replace the account.

Do not rerun an old script that creates a missing key. Update the MCP registration after migration to use the named account or [external signer](external-signer.md).

## Vault API status and read-only preview

The source tree now contains a trusted local Vault wallet API in
`utils/vaultWalletController.ts` for integrators who supply an installed
`@opl.dev/vault` module. `createVaultWalletController`
loads project role bindings from an explicit absolute project root and project
ID, resolves the bound existing account and machine-local Vault path, and
supports the `direct-v1` contract for a selected private-key or WIF entry. An
unlock validates the Vault ID, entry ID and public key, initializes the wallet
with the existing account's network and storage configuration, and returns only
public session status. The session facade supports operations through
`controller.run(role, operation)`, a bounded TTL, and `controller.lock()`; stale
project bindings and expired or locked sessions revoke access and clean up the
wallet.

This API is not wired into the MCP server, launcher, or normal startup yet. The
shipped server still opens an existing account's `keys.bep` with
`BSV_MCP_PASSWORD`, and legacy WIF environment variables remain a compatibility
path with a migration warning. The optional Vault package is not a required
runtime dependency. The source launcher can validate and forward paired
`--project-root` and `--project-id` selectors, but those selectors do not unlock
a Vault role or select a project in the server yet.

From a source checkout, run `bun run index.ts vault-setup` to open a local,
read-only setup preview. It inventories named accounts, older
`~/.bsv-mcp/keys.bep` or `keys.json` backups, the Sigma lab's `root.wif`, and
known wallet database filenames including `wallet.db`. It also reports whether
environment keys and a Vault file are present, without reading key contents or
unlocking anything.

The preview binds only to loopback, opens your browser, and stays running until Ctrl+C or its five-minute timeout. If the browser cannot open, the command prints a local link. Keep that link private because it grants access to the inventory. Closing the browser tab does not stop the server.

This preview cannot import, delete, or switch keys. `wallet_migrate` still
migrates legacy sources into the existing encrypted account format; it does not
write a Vault or activate the new controller. Vault import, project-role
selection in the server, and the migration wizard remain unwired. Existing
wallet behavior is unchanged.
