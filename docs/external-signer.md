# Keep signing outside the MCP process

An external signer owns the keys and authorizes wallet requests. BSV MCP connects using the SDK's [BRC-100](https://www.beersy.dev/brc/100) `HTTPWalletJSON` interface.

```sh
BRC100_WALLET_URL=http://127.0.0.1:3321
BRC100_WALLET_ORIGINATOR=bsv-mcp.local
BSV_CHAIN=main
```

The URL must point to signer RPC. `/1sat/wallet` and `1sat serve wallet` expose storage RPC and are not substitutes. Remove `PRIVATE_KEY_WIF` and `IDENTITY_KEY_WIF`. The MCP process then bypasses local key loading and storage provisioning. Your signer controls permissions.

## Bundled local signer

```sh
bunx bsv-mcp@latest signer-serve --account sigma-lab
```

This command unlocks the named account, binds signer RPC to an ephemeral loopback port, and launches the MCP stdio child. It owns both lifecycles. The RPC path contains a fresh random token that is passed directly to the child, never logged or written to disk. Requests must be POSTs with the exact `http://bsv-mcp.local` Origin and an SDK wallet method. The child receives no WIF or account password variables.

`createAction` and `signAction` require local terminal confirmation. If a headless MCP host has no terminal available, those calls fail closed. Use an existing signer with its own approval UI for interactive payments from that host. The Origin header and secret path restrict access; they are not a replacement for payment approval.

The bundled signer can prompt for its password in a local terminal. When a client launches it headlessly, arrange `BSV_MCP_PASSWORD` in the signer's environment. The wrapper removes that value from the child environment. Do not commit passwords or paste them into chat.

A migration must finish before replacing an existing signer wrapper. Preserve the account's storage identity, database and deposit prefix. Do not create another wallet to make a failing connection succeed.
