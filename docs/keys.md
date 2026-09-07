# Wallet accounts

Each account owns one directory:

```text
~/.bsv-mcp/accounts/<name>/
  config.json
  keys.bep
  wallet-main.db       # or wallet-test.db
```

`config.json` records the network, storage identity and optional `activeRemote` and `backups` URLs. `keys.bep` contains the encrypted payment key and any legacy identity keys. The SQLite database records wallet transactions and derived outputs. Back up all three; a root key alone is not a complete wallet backup. The wallet may also create SQLite sidecars, task state and an audit log in the same directory.

Directories use mode 0700 and new files use 0600. Account names contain lowercase letters, digits, underscores or hyphens. Agents must never create wallet directories outside `~/.bsv-mcp`.

## Set up an account

Run this yourself in a local terminal:

```sh
bunx bsv-mcp@latest init --account default
```

Choose the network and whether to generate or import a key. Enter the encryption password twice. WIF imports are hidden. The command reports only the public address; it never prints a private key. Back up the encrypted files and keep the password separately before funding the wallet.

For headless use, supply `BSV_MCP_PASSWORD` through the process environment and select `BSV_MCP_ACCOUNT` (default: `default`). Do not put secrets in chat, command arguments, or committed configuration.

Key resolution is explicit: `BRC100_WALLET_URL` selects an external signer and rejects conflicting local key variables. Otherwise `PRIVATE_KEY_WIF` takes precedence over the selected encrypted account. A bad key or password stops startup. There is no plaintext fallback and no automatic generation. Read-only operation is available with `DISABLE_WALLET_TOOLS=true`.

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

The legacy source is `~/.bsv-mcp/keys.json`. The lab source is `~/.local/share/sigma-brc169-lab/root.wif` and `wallet.db`. The lab migration preserves `storageIdentityKey: sigma-brc169-lab` and the `1sat` deposit prefix. Legacy migration preserves `storageIdentityKey: bsv-mcp`. A legacy database stored elsewhere must be preserved separately before adopting the account; the migration does not guess its location.

Verify the encrypted account and database and make a backup before rerunning with `--erase-source`. That option overwrites and removes the source plaintext file after confirmation. Overwriting cannot guarantee erasure from SSDs, APFS snapshots, backups or other copies. It does not modify experiment scripts or delete their directories. Repeating migration with the same identity does not replace the account.

Do not rerun an old script that creates a missing key. Update the MCP registration after migration to use the named account or [external signer](external-signer.md).
