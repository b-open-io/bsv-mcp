# Keep signing outside the MCP process

An external signer owns the keys and authorizes wallet requests. BSV MCP connects using the SDK's [BRC-100](https://www.beersy.dev/brc/100) `HTTPWalletJSON` interface. The source checkout's local launcher has an explicit `external` mode for this connection; the launcher is not shipped in the npm package.

```sh
BRC100_WALLET_URL=http://127.0.0.1:3321
BRC100_WALLET_ORIGINATOR=bsv-mcp.local
```

The URL must point to signer RPC. `/1sat/wallet` and `1sat serve wallet` expose storage RPC and are not substitutes. Remove `PRIVATE_KEY_WIF`, `IDENTITY_KEY_WIF`, and local-account password variables from the external launcher's environment. The MCP process then bypasses local key loading and storage provisioning. Your signer controls permissions.

The launcher uses the server's default `main` chain for external mode. The
launcher has no chain selector yet; a testnet external signer requires a
separate process configuration that passes `BSV_CHAIN=test` directly to the
server.

## Register external mode from a source checkout

Build the checkout once, then register the launcher with the MCP host:

```sh
git clone https://github.com/b-open-io/bsv-mcp.git
cd bsv-mcp
bun install
bun run build

# Codex; the URL and originator are non-secret registration values.
codex mcp add bsv-mcp-external \
  --env BRC100_WALLET_URL=https://signer.example/rpc \
  --env BRC100_WALLET_ORIGINATOR=bsv-mcp.local \
  -- bun --no-env-file /absolute/path/to/bsv-mcp/scripts/local-mcp-launcher.ts external
```

Claude Code and other stdio clients use the same launcher command. The launcher
validates the URL and originator, strips conflicting local-wallet selectors,
uses an isolated temporary home and working directory, and starts the checked-
out `dist/index.js`. It reads the signer settings at runtime; do not rely on a
repository `.env` file.

## Bundled local signer

```sh
bunx bsv-mcp@latest signer-serve --account sigma-lab
```

This packaged command is a separate local-signer wrapper: it unlocks the named
encrypted account, binds signer RPC to an ephemeral loopback port, and launches
the MCP stdio child. It owns both lifecycles. The RPC path contains a fresh
random token that is passed directly to the child, never logged or written to
disk. Requests must be POSTs with the exact `http://bsv-mcp.local` Origin and an
SDK wallet method. The child receives no WIF or account password variables.

`createAction` and `signAction` require local terminal confirmation. If a headless MCP host has no terminal available, those calls fail closed. Use an existing signer with its own approval UI for interactive payments from that host. The Origin header and secret path restrict access; they are not a replacement for payment approval.

The bundled signer can prompt for its password in a local terminal. When a client launches it headlessly, arrange `BSV_MCP_PASSWORD` in the signer's environment. The wrapper removes that value from the child environment. Do not commit passwords or paste them into chat.

The Vault controller and migration preview are present in the source tree but
are not connected to this signer wrapper. `vault-setup` is read-only and
`wallet_migrate` still creates the existing encrypted account format. Complete
any account migration before replacing an existing signer wrapper. Preserve the
account's storage identity, database and deposit prefix. Do not create another
wallet to make a failing connection succeed.
