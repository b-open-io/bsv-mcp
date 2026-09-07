# BSV MCP

BSV MCP connects your AI assistant to Bitcoin SV. Ask it to check a transaction, show your balance, send a payment, or create and trade ordinals (content recorded on the blockchain).

[Documentation](https://bsvmcp.com/docs) · [Connect hosted](https://bsvmcp.com/connect) · [npm](https://www.npmjs.com/package/bsv-mcp) · [Issues](https://github.com/b-open-io/bsv-mcp/issues)

## Quick start

Install [Bun](https://bun.sh). Set up an encrypted account with `bunx bsv-mcp@latest init`, or connect an existing signer as described in [wallet setup](https://bsvmcp.com/docs#wallets). Then register the server:

```sh
# Codex
codex mcp add bsv-mcp -- bunx bsv-mcp@latest --stdio

# Claude Code
claude mcp add --transport stdio bsv-mcp -- bunx bsv-mcp@latest --stdio
```

Or install the Claude Code plugin from the b-open-io marketplace:

```sh
claude plugin install bsv-mcp@b-open-io
```

For other clients, use `bunx bsv-mcp@latest --stdio` as the MCP server command (stdio transport). For hosted access, connect to **https://bsvmcp.com**. See [client setup](https://bsvmcp.com/#install).

Ask your agent: **“Run bsv_status, then show my wallet balance.”**

## Bring your wallet and infrastructure

Connect a compatible existing wallet with `BRC100_WALLET_URL`, or select an encrypted account with `BSV_MCP_ACCOUNT` and unlock it with `BSV_MCP_PASSWORD` in the process environment. Startup never creates keys. An existing wallet keeps its keys and controls permissions. See the wallet setup guide for the required wallet API and configuration.

The default 1Sat backend is `https://api.1sat.app`. Override `ONESAT_API_URL` to use a compatible deployment; configure wallet storage, explorer, content, and legacy services separately. Available tools depend on wallet mode and enabled modules.

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
bun dist/index.js --stdio # Local stdio launch; npm publication is not required
bun test
```

Experimental software; APIs may change. Keep a wallet backup. If a transaction request times out, check whether it succeeded before sending it again. MIT licensed.
