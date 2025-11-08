# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BSV MCP is a Model Context Protocol server that exposes Bitcoin SV (BSV) blockchain functionality to AI assistants. It provides tools for wallet operations, ordinals (NFTs), tokens, identity management, and social features through a modular architecture.

**Current Version: 0.2.0-alpha.1**

The project supports three deployment modes:
1. **Local MCP Server** - Runs via stdio transport with OAuth 2.1 authentication
2. **HTTP/SSE Server** - Runs as HTTP server with JWT validation
3. **CloudFlare Worker** - Hosted implementation with OAuth 2.1 and Bitcoin-auth

## Essential Commands

### Local Development
```bash
# Install dependencies
bun install

# Build the project
bun build ./index.ts --outdir ./dist --target node

# Run locally (stdio mode for Claude Code)
bun run index.ts

# Run with environment variables
TRANSPORT=stdio USE_DROPLET_API=true bun run index.ts

# Run tests
bun test

# Lint code
bun run lint

# Fix linting issues
bun run lint:fix
```

### CloudFlare Worker Deployment
```bash
# Navigate to cloudflare directory
cd cloudflare

# Deploy the worker
wrangler deploy

# Check worker logs
wrangler tail

# Test locally
wrangler dev
```

### Testing with Claude Code CLI
```bash
# Add to Claude Code
claude mcp add bsv-mcp "bun run index.ts"

# List configured servers
claude mcp list

# Remove and re-add (useful after changes)
claude mcp remove bsv-mcp
claude mcp add bsv-mcp "bun run index.ts"
```

### CloudFlare Frontend (Next.js)
```bash
cd cloudflare/frontend

# Development
bun dev

# Build
bun run build

# Lint
bun run lint
```

## Core Architecture

### Entry Point
- **index.ts**: Main server initialization with stdio or HTTP/SSE transport
  - Key initialization with SecureKeyManager
  - Transport mode detection (stdio/http)
  - Conditional tool/prompt/resource registration based on env vars

### Tool System
- **tools/**: Modular tool categories, each with registration function
  - `bsv/` - Price, transaction decoding, blockchain explorer
  - `wallet/` - Send, receive, UTXOs, ordinals creation, collection minting
  - `ordinals/` - NFT operations, marketplace listings
  - `mnee/` - MNEE token operations
  - `bap/` - Bitcoin Attestation Protocol identity management
  - `bsocial/` - Social posts, likes, follows
  - `bigblocks/` - React component registry and code generation
  - `utils/` - Data conversion, encoding utilities
  - `a2b/` - Agent-to-blockchain publishing (disabled by default)

### Wallet Architecture
- **Dual Mode Support**:
  - **Local Wallet Mode**: Uses `Wallet` class with local private keys
  - **Droplet API Mode**: Uses `IntegratedWallet` with remote faucet service
- **Key Types**: Payment key (payPk), Identity key (identityPk), BAP master (xprv)
- **Authentication**: OAuth 2.1 with sigma-auth for MCP clients, BSM for Droplet API operations

### Key Management (SecureKeyManager)
- **Encrypted Storage**: `~/.bsv-mcp/keys.bep` (bitcoin-backup format)
- **Legacy Format**: `~/.bsv-mcp/keys.json` (backward compatible)
- **Dynamic Passphrase Prompting**: Web-based secure passphrase entry
- **Auto-migration**: Converts legacy keys to encrypted format
- **Priority Order**:
  1. PRIVATE_KEY_WIF environment variable (payPk only)
  2. Encrypted keys.bep file (with passphrase prompt)
  3. Legacy keys.json file (unencrypted)
  4. Auto-generate new payPk and save

### Content & Resources
- **prompts/**: Educational content about BSV SDK, ordinals, protocols
- **resources/**: BRC specifications, protocol docs, changelog
- **utils/**: Shared utilities (broadcasting, buffer ops, error handling, key management)

## Tool Registration Pattern

Each tool category follows this pattern:

```typescript
// tools/category/index.ts
export function registerCategoryTools(
  server: McpServer,
  config?: CategoryConfig
): void {
  server.addTool({
    name: "category_toolName",
    description: "...",
    inputSchema: zodSchema,
  }, async (params) => {
    // Implementation
  });
}
```

Main registration in `tools/index.ts` conditionally loads categories based on:
- Environment variables (DISABLE_*_TOOLS, ENABLE_*_TOOLS)
- ToolsConfig object passed from index.ts
- Key availability (payPk, identityPk, xprv)

## Environment Variables

### Core Configuration
- `TRANSPORT`: Transport mode ('stdio' for Claude Code, 'http' for HTTP/SSE, default: http)
- `PORT`: HTTP server port (default: 3000)
- `PRIVATE_KEY_WIF`: Bitcoin SV payment private key in WIF format (optional)
- `IDENTITY_KEY_WIF`: Identity key for BAP operations (optional)
- ~~`BSV_MCP_PASSPHRASE`~~: **DEPRECATED - DO NOT USE** (security issue, removed in v0.1.0)

### OAuth 2.1 Authentication
- `ENABLE_OAUTH`: Enable OAuth 2.1 authentication with sigma-auth (default: false)
- `OAUTH_ISSUER`: OAuth issuer URL (sigma-auth server, default: https://auth.sigmaidentity.com)
- `RESOURCE_URL`: This resource server's URL for JWT validation (default: http://localhost:3000)

**How it works**:
- Authentication is proven via Bitcoin signature - no pre-registration needed
- User's pubkey from Bitcoin signature becomes their client identity
- BAP ID is resolved for usage tracking and billing
- Access tokens are JWTs validated using JWKS from the issuer
- Follows MCP 2025-03-26 specification and OAuth 2.1 standards

### Droplet API Mode
- `USE_DROPLET_API`: Enable Droplet API mode (true/false, default: false)
- `DROPLET_API_URL`: Droplet API endpoint (default: http://127.0.0.1:4000)
- `DROPLET_FAUCET_NAME`: Name of the faucet to use (required when USE_DROPLET_API=true)

### Feature Toggles
- `DISABLE_PROMPTS`: Disable all prompts (default: false)
- `DISABLE_RESOURCES`: Disable all resources (default: false)
- `DISABLE_TOOLS`: Disable all tools (default: false)
- `DISABLE_WALLET_TOOLS`: Disable wallet tools (default: false)
- `DISABLE_MNEE_TOOLS`: Disable MNEE token tools (default: false)
- `DISABLE_BSV_TOOLS`: Disable BSV blockchain tools (default: false)
- `DISABLE_ORDINALS_TOOLS`: Disable ordinals/NFT tools (default: false)
- `DISABLE_UTILS_TOOLS`: Disable utility tools (default: false)
- `DISABLE_BAP_TOOLS`: Disable BAP identity tools (default: false)
- `DISABLE_BSOCIAL_TOOLS`: Disable BSocial tools (default: false)
- `DISABLE_BIGBLOCKS_TOOLS`: Disable BigBlocks tools (default: false)
- `ENABLE_A2B_TOOLS`: Enable agent-to-blockchain tools (default: false)
- `DISABLE_BROADCASTING`: Disable transaction broadcasting (default: false, useful for testing)

### Key Management
- `BSV_MCP_AUTO_MIGRATE`: Auto-migrate from unencrypted to encrypted keys (default: true)
- `BSV_MCP_KEEP_LEGACY`: Keep legacy unencrypted file after migration (default: false)

## Important Conventions

1. **Schema Validation**: Use Zod schemas for all tool inputs
2. **Error Handling**: Use colored console output (red=errors, yellow=warnings, green=success)
3. **File Paths**: Always use absolute paths, never relative paths
4. **Broadcasting Control**: Respect DISABLE_BROADCASTING for testing workflows
5. **Price Caching**: BSV price data cached for 5 minutes to reduce API calls
6. **Tool Dependencies**: Tools requiring keys gracefully fail with helpful messages when keys unavailable
7. **OAuth Authentication**: MCP clients authenticate via sigma-auth with Bitcoin signatures (no pre-registration)
8. **Passphrase Security**: NEVER store passphrases in environment variables (removed in v0.1.0)
9. **JWT Validation**: Access tokens validated using JWKS from sigma-auth issuer

## Adding New Tools

1. Create new file in appropriate `tools/` subdirectory
2. Define tool function with proper TypeScript types
3. Add Zod schema for input validation
4. Register tool in category's `index.ts` file
5. Update main registration in `tools/index.ts` if creating new category
6. Consider both local wallet and Droplet API modes for transaction-based tools
7. Add tests in `.test.ts` file following existing patterns

Example structure:
```typescript
// tools/category/myTool.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const myToolSchema = z.object({
  param: z.string().describe("Description")
});

export function registerMyTool(server: McpServer): void {
  server.addTool({
    name: "category_myTool",
    description: "What this tool does",
    inputSchema: zodToJsonSchema(myToolSchema),
  }, async (params) => {
    const { param } = myToolSchema.parse(params);
    // Implementation
    return { content: [{ type: "text", text: result }] };
  });
}
```

## Testing Strategies

### Unit Tests
- Create `.test.ts` files alongside implementation
- Mock external dependencies (API calls, file operations)
- Test both success and error cases
- Reference `tools/bap/generate.test.ts` and `tools/bap/getId.test.ts` for patterns

### Integration Testing with MCP
Use Claude Code CLI for end-to-end testing:
```bash
claude mcp add bsv-mcp-dev "bun run index.ts"
# Test tools through natural language in Claude Code
```

### Programmatic Testing
```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "bun",
  args: ["run", "index.ts"],
  env: { TRANSPORT: "stdio" }
});

const client = new Client({ name: "test", version: "1.0.0" }, {});
await client.connect(transport);
const result = await client.callTool({ name: "tool_name", arguments: {} });
```

### Droplet API Testing
1. Start go-faucet-api locally
2. Configure env vars: USE_DROPLET_API=true, DROPLET_API_URL, DROPLET_FAUCET_NAME
3. Run test scripts or use Claude Code to test wallet operations

## Security Best Practices

1. **No Plaintext Passphrases**: BSV_MCP_PASSPHRASE removed in v0.1.0
2. **Dynamic Prompting**: Passphrases entered via temporary web interface
3. **Encrypted Storage**: AES-256-GCM with 600,000 PBKDF2 iterations (bitcoin-backup)
4. **File Permissions**: Key files automatically created with 0600 permissions
5. **Key Backup**: Automatic backup creation (keys.bep.backup) before operations
6. **Authentication**: BSM signatures for Droplet API, Bitcoin-auth for hosted service

## Troubleshooting

### "Faucet not found" error in Droplet mode
- Ensure faucet exists in Droplet API
- Check DROPLET_FAUCET_NAME matches existing faucet name

### Authentication errors with Droplet API
- Verify BSM signature format compatibility
- Ensure key registered with API via `/auth/register`
- Check go-bitcoin-auth version matches

### MCP server not connecting in Claude Code
- Verify TRANSPORT=stdio (automatic in Claude Code, but check manually if issues)
- Run `bun install` to ensure all dependencies installed
- Try `claude mcp remove bsv-mcp && claude mcp add bsv-mcp "bun run index.ts"`

### Tools not appearing
- Check server logs for initialization errors
- Verify required environment variables set
- Ensure tool category not disabled via DISABLE_*_TOOLS
- Check key availability for wallet/BAP/MNEE tools

### Tests failing with WIF key errors
- Generate valid WIF key using BSV SDK
- Mock network calls properly in tests
- Check test file WIF format matches network (mainnet vs testnet)

## Current Development Focus

### Phase 1 - Security Enhancement (Completed in v0.1.0)
- ✅ Removed BSV_MCP_PASSPHRASE environment variable
- ✅ Implemented dynamic passphrase prompting via web interface
- ✅ Updated key loading/saving flows
- ✅ Migration path for users with legacy env var

### Current Architecture Notes
- **Wallet Detection**: System detects wallet presence at startup and logs configuration
- **Tool Loading**: Tools conditionally loaded based on key availability
- **Three Deployment Modes**: Local (with keys), Droplet API (remote wallet), Hosted (CloudFlare)
- **Storage Formats**: Encrypted .bep (preferred) vs legacy JSON (deprecated)

## Future Development Roadmap

High-priority features for future releases:
- **Enhanced Onboarding**: Guided setup flow for new users
- **Collection Minter Improvements**: More metadata options, batch operations
- **Additional Protocols**: Support for more BSV protocols and standards
