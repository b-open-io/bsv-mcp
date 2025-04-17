# Bitcoin SV MCP Server

[![smithery badge](https://smithery.ai/badge/@b-open-io/bsv-mcp)](https://smithery.ai/server/@b-open-io/bsv-mcp)

> **⚠️ NOTICE: Experimental Work in Progress**  
> This project is in an early experimental stage. Features may change, and the API is not yet stable.
> Contributions, feedback, and bug reports are welcome! Feel free to open issues or submit pull requests.

A collection of Bitcoin SV (BSV) tools for the Model Context Protocol (MCP) framework. This library provides wallet, ordinals, and utility functions for BSV blockchain interaction.

## Installation

To install dependencies:

```bash
bun install
```

## External Dependencies

For full functionality of all tools, the following additional dependencies are installed:

```bash
# For ordinal listing purchase functionality
js-1sat-ord
```

## Running the Server

Start the MCP server:

```bash
bun run index.ts
```

## Connecting to MCP Clients

This server implements the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP), allowing AI assistants to utilize Bitcoin SV functionalities. You can connect this server to various MCP-compatible clients.

### Cursor

To use the BSV MCP server with [Cursor](https://cursor.sh/):

1. Install Cursor if you haven't already
2. Clone this repository and run `bun install` in the project directory
3. Open Cursor and navigate to Settings → Extensions → Model Context Protocol
4. Click "Add a new global MCP server"
5. Enter the following configuration in JSON format:

```json
{
  "Bitcoin SV": {
    "command": "env",
    "args": [
      "PRIVATE_KEY_WIF=<your_private_key_wif>",
      "bun",
      "run",
      "<path_to_project>/index.ts"
    ]
  }
}
```

6. Replace `<your_private_key_wif>` with your actual private key WIF (keep this secure!)
7. Replace `<path_to_project>` with the full path to where you cloned this repository
8. Click "Save"

The BSV tools will now be available to Cursor's AI assistant under the "Bitcoin SV" namespace.

### Claude for Desktop

To connect this server to Claude for Desktop:

1. Ensure you have [Claude for Desktop](https://claude.ai/desktop) installed and updated to the latest version
2. Clone this repository and run `bun install` in the project directory
3. Open your Claude for Desktop configuration file:
   ```bash
   # macOS/Linux
   code ~/Library/Application\ Support/Claude/claude_desktop_config.json
   
   # Windows
   code %APPDATA%\Claude\claude_desktop_config.json
   ```
4. Add the BSV MCP server to your configuration (create the file if it doesn't exist):
   ```json
   {
     "mcpServers": {
       "Bitcoin SV": {
         "command": "env",
         "args": [
           "PRIVATE_KEY_WIF=<your_private_key_wif>",
           "bun",
           "run",
           "<path_to_project>/index.ts"
         ]
       }
     }
   }
   ```
5. Replace `<your_private_key_wif>` with your actual private key WIF
6. Replace `<path_to_project>` with the full path to where you cloned this repository
7. Save the file and restart Claude for Desktop
8. The BSV tools will appear when you click the tools icon (hammer) in Claude for Desktop

### Generic MCP Client Integration

For other MCP clients that support JSON configuration:

```json
{
  "Bitcoin SV": {
    "command": "env",
    "args": [
      "PRIVATE_KEY_WIF=<your_private_key_wif>",
      "bun",
      "run",
      "<path_to_project>/index.ts"
    ]
  }
}
```

If running the server directly:

```bash
# Set environment variable first
export PRIVATE_KEY_WIF=<your_private_key_wif>

# Then run the server
bun run index.ts
```

## Available Tools

The toolkit is organized into several categories:

### Wallet Tools

Wallet tools provide core BSV wallet functionality:

| Tool Name | Description |
|-----------|-------------|
| `wallet_getPublicKey` | Retrieves a public key for a specified protocol and key ID |
| `wallet_createSignature` | Creates a cryptographic signature for the provided data |
| `wallet_verifySignature` | Verifies a cryptographic signature against the provided data |
| `wallet_encryption` | Combined tool for encrypting and decrypting data using the wallet's cryptographic keys (replaces separate encrypt/decrypt tools) |
| `wallet_getAddress` | Returns a BSV address for the current wallet or a derived path |
| `wallet_sendToAddress` | Sends BSV to a specified address (supports BSV or USD amounts) |
| `wallet_purchaseListing` | Purchases NFTs or BSV-20/BSV-21 tokens from marketplace listings |
| `wallet_createOrdinals` | Creates and inscribes ordinals on the BSV blockchain |

### BSV Tools

Tools for interacting with the BSV blockchain and network:

| Tool Name | Description |
|-----------|-------------|
| `bsv_getPrice` | Gets the current BSV price from an exchange API |
| `bsv_decodeTransaction` | Decodes a BSV transaction and returns detailed information |

### Ordinals Tools

Tools for working with ordinals (NFTs) on BSV:

| Tool Name | Description |
|-----------|-------------|
| `ordinals_getInscription` | Retrieves detailed information about a specific inscription |
| `ordinals_searchInscriptions` | Searches for inscriptions based on various criteria |
| `ordinals_marketListings` | Retrieves market listings for NFTs, BSV-20, and BSV-21 tokens with unified interface |
| `ordinals_marketSales` | Gets information about BSV-20 and BSV-21 token market sales |
| `ordinals_getBsv20ById` | Retrieves details about a specific BSV20 token by ID |

### Utility Tools

General-purpose utility functions:

| Tool Name | Description |
|-----------|-------------|
| `utils_convertData` | Converts data between different encodings (utf8, hex, base64, binary) |

## Using the Tools with MCP

Once connected, you can use natural language to interact with Bitcoin SV through your AI assistant. Here are some example prompts:

### Wallet Operations
- "Get my Bitcoin SV address"
- "Send 0.01 BSV to 1ExampleBsvAddressXXXXXXXXXXXXXXXXX"
- "Send $5 USD worth of BSV to 1ExampleBsvAddressXXXXXXXXXXXXXXXXX"
- "Encrypt this message using my wallet's keys"
- "Decrypt this data that was previously encrypted for me"
- "Purchase this NFT listing: txid_vout"
- "Purchase this BSV-20 token listing: txid_vout"

### Ordinals (NFTs)
- "Show me information about the NFT with outpoint 6a89047af2cfac96da17d51ae8eb62c5f1d982be2bc4ba0d0cd2084b7ffed325_0"
- "Search for Pixel Zoide NFTs"
- "Show me the current marketplace listings for BSV NFTs"
- "Show me BSV-20 token listings for ticker PEPE"
- "Get recent BSV-20 token sales"

### Blockchain Operations
- "What is the current BSV price?"
- "Decode this BSV transaction: (transaction hex or ID)"

### Data Conversion
- "Convert 'Hello World' from UTF-8 to hex format"

## How MCP Works

When you interact with an MCP-enabled AI assistant:

1. The AI analyzes your request and decides which tools to use
2. With your approval, it calls the appropriate BSV MCP tool
3. The server executes the requested operation on the Bitcoin SV blockchain
4. The results are returned to the AI assistant
5. The assistant presents the information in a natural, conversational way

## Troubleshooting

If you're having issues connecting to the server:

1. Ensure the package dependencies are properly installed: `bun install`
2. Verify your WIF private key is correctly set in the environment
3. Check that your client supports MCP and is properly configured
4. Look for error messages in the client's console output

For Claude for Desktop, check the logs at:
```bash
tail -n 20 -f ~/Library/Logs/Claude/mcp*.log
```

For Cursor, check the Cursor MCP logs in Settings → Extensions → Model Context Protocol.

## Recent Updates

### Unified Encryption Tool
- **Combined Wallet Encryption**: The `wallet_encrypt` and `wallet_decrypt` tools have been merged into a single `wallet_encryption` tool with a mode parameter to switch between encryption and decryption operations.

### Enhanced Marketplace Tools
- **Unified Market Listings**: The `ordinals_marketListings` tool now supports NFTs, BSV-20, and BSV-21 tokens through a single interface with appropriate filtering.
- **Improved Market Sales**: The `ordinals_marketSales` tool (renamed from `ordinals_bsv20MarketSales`) now supports both BSV-20 and BSV-21 token sales.
- **Token Purchases**: The `wallet_purchaseListing` tool has been enhanced to support purchasing both NFTs and BSV-20/BSV-21 tokens.

### API Refinements
- Standardized endpoint structure for interactions with the GorillaPool API.
- Improved parameter handling for different token types and marketplace actions.

## Development

This project was created using `bun init` in bun v1.2.9. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

### Package Configuration

The main entry point for this package is `index.ts`.

### Running Tests

```bash
bun test
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
