---
name: bsv-mcp
description: Use BSV MCP to inspect Bitcoin SV transactions, addresses, ordinals, and service availability, or help connect a local wallet and request paid services.
---

Start with `bsv_status` to discover the available services. Use the tools actually
exposed by this connection; do not assume a personal wallet is connected.

This plugin launches a local stdio MCP server. No Sigma account or OAuth sign-in
is required. Never ask for a private key, seed phrase, wallet backup, password,
or copied access token.

For wallet operations, follow https://bsvmcp.com/docs#wallets. Create, import, or
unlock a Vault through `wallet_onboarding` in the local browser, or connect an
existing BRC-100 wallet with `BRC100_WALLET_URL`. Wallet setup and spending
approval are separate from any website login. Never create a replacement wallet
automatically.

For x402, inspect the service's quote first. Pay only after the user authorizes
the service and amount, using the available wallet permission flow. Do not retry
an uncertain payment automatically. See https://bsvmcp.com/docs#x402.

Report confirmed results and distinguish unavailable capabilities from failures.
