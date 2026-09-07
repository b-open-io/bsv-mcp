---
name: bsv-mcp
description: Use BSV MCP to inspect Bitcoin SV transactions, addresses, ordinals, and service availability, or help connect a wallet and request paid services.
---

Start with bsv_status to discover the available services. Use the tools actually
exposed by this connection; do not assume a personal wallet is connected.

The plugin connects to hosted BSV MCP. If authentication is required, direct the
user to the client's connection controls to authorize Sigma Identity. Never ask
for a private key, seed phrase, wallet backup, password, or copied access token.

For wallet operations, follow https://bsvmcp.com/docs#wallets. A hosted connection
cannot reach a signer on the user's computer. Wallet setup and spending approval
are separate from signing in. Never create a replacement wallet automatically.

For x402, inspect the service's quote first. Pay only after the user authorizes
the service and amount, using the available wallet permission flow. Do not retry
an uncertain payment automatically. See https://bsvmcp.com/docs#x402.

Report confirmed results and distinguish unavailable capabilities from failures.
