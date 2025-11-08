# BSV MCP Hosted Mode

Use Bitcoin SV features without needing any BSV! Our hosted mode lets you authenticate with a Bitcoin key while the server pays for all transactions.

## Quick Start (For Users)

### Option 1: Auto Setup (Recommended)
```bash
# Clone and setup
git clone https://github.com/b-open-io/bsv-mcp
cd bsv-mcp
bun install

# Auto-generate authentication keys
bun run setup-auth https://bsv-mcp.rohenaz.workers.dev
```

This will:
- ✅ Generate a Bitcoin key pair for authentication
- ✅ Save it to `~/.bsv-mcp/keys.json` 
- ✅ Show you the MCP configuration to copy
- ✅ No BSV required in your wallet!

### Option 2: Web Interface
Visit `https://bsv-mcp.rohenaz.workers.dev` to:
- Generate keys in your browser
- Get formatted MCP configuration
- Test your authentication

## User Experience Flow

### First Time User (No Keys)
1. **User runs:** `bun run setup-auth https://bsv-mcp.rohenaz.workers.dev`
2. **System generates:** Bitcoin key pair automatically
3. **System saves:** Keys to `~/.bsv-mcp/keys.json`
4. **System shows:** MCP configuration to copy
5. **User copies:** Config to their IDE settings
6. **Done!** User can now use BSV features without BSV

### Existing User (Has Keys)
1. **System detects:** Existing keys in `~/.bsv-mcp/`
2. **System shows:** Current configuration
3. **User updates:** Server URL if needed
4. **Done!** Authentication works seamlessly

### Example Output
```
🔑 Generating new authentication key...
💾 Saved authentication key to: ~/.bsv-mcp/keys.json
💡 Tip: Set BSV_MCP_PASSPHRASE env var to encrypt your keys

🎉 BSV MCP Authentication Setup Complete!

Your Authentication Credentials:
  Public Key: 03a1b2c3d4e5f6...
  Address: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
  Stored in: ~/.bsv-mcp/

📋 MCP Configuration:
Add this to your IDE's MCP settings:

{
  "mcpServers": {
    "bsv-mcp": {
      "transport": "sse",
      "url": "https://bsv-mcp.rohenaz.workers.dev/mcp",
      "privateKeyWif": "L1abc..."
    }
  }
}

✨ Setup complete! You can now use BSV MCP without any BSV in your wallet.
   The server will pay for all your on-chain transactions.
```

## How Authentication Works

1. **Your key is for authentication only** - No BSV needed
2. **Server pays for everything** - All transactions subsidized
3. **Cryptographic signatures** - Each request is signed with your key
4. **Rate limiting** - Prevents abuse while keeping it free
5. **Standard protocol** - Uses `bitcoin-auth` package

## Security

- ✅ Your private key never leaves your machine
- ✅ Server's funding key is never exposed 
- ✅ Time-based signatures prevent replay attacks
- ✅ Rate limiting prevents abuse
- ✅ Optional key encryption with passphrase

## For Server Operators

### Setup Hosted Server
```bash
# Environment variables
export SERVER_PRIVATE_KEY_WIF="L1abc..."  # Your funded wallet
export DROPLET_API_URL="https://droplet.api.com"
export DROPLET_FAUCET_NAME="your-faucet"

# Start server
bun run hosted-server
```

### Features
- Auto-generates user keys if none exist
- Web interface for manual setup
- Rate limiting per public key
- Helpful error messages for unauthenticated users
- Cost monitoring and analytics

### Cost Estimation
With BSV fees at ~$0.00001 per transaction:
- 100,000 user transactions ≈ $1
- 1 million user transactions ≈ $10
- 10 million user transactions ≈ $100

Perfect for subsidizing user onboarding!

## IDE Integration

### Claude Desktop
```json
{
  "mcpServers": {
    "bsv-mcp": {
      "transport": "sse", 
      "url": "https://bsv-mcp.rohenaz.workers.dev/mcp",
      "privateKeyWif": "L1abc..."
    }
  }
}
```

### Cursor
```json
{
  "mcpServers": {
    "bsv-mcp": {
      "transport": "sse",
      "url": "https://bsv-mcp.rohenaz.workers.dev/mcp", 
      "privateKeyWif": "L1abc..."
    }
  }
}
```

## Available Features

Once authenticated, users get access to:
- **Social Posts** - Create and read on-chain posts
- **Ordinals** - NFT operations and marketplace
- **Tokens** - Transfer and manage tokens
- **Blockchain** - Explore transactions and addresses
- **Utilities** - Address generation, data conversion
- **Identity** - BAP identity operations (limited)

All operations are **free for users** - the server subsidizes everything!

## Troubleshooting

### "Authentication required" error
Run: `bun run setup-auth https://bsv-mcp.rohenaz.workers.dev`

### "Invalid authentication token" 
- Check your system clock is accurate
- Regenerate keys: `bun run setup-auth https://bsv-mcp.rohenaz.workers.dev`
- Verify server URL in MCP config

### Keys not found
The auto-setup creates keys in `~/.bsv-mcp/keys.json`. If missing:
- Run setup again: `bun run setup-auth https://bsv-mcp.rohenaz.workers.dev`
- Check file permissions on `~/.bsv-mcp/`

### Rate limiting
Free tier includes generous limits. If exceeded:
- Wait for rate limit reset
- Contact server operator for higher limits
- Consider running your own server