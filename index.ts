#!/usr/bin/env bun
import { PrivateKey } from "@bsv/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools";
import { registerWalletTools } from "./tools/wallet/tools";
import { Wallet } from "./tools/wallet/wallet";

/**
 * Validate the private key from environment variables
 * Exits the process with an error message if validation fails
 */
function validatePrivateKey(): PrivateKey {
	const privateKeyWif = process.env.PRIVATE_KEY_WIF;
	
	// Check if private key is set
	if (!privateKeyWif) {
		console.error("\x1b[31mError: PRIVATE_KEY_WIF environment variable is not set\x1b[0m");
		console.error("Please set this variable with a valid Bitcoin SV private key in WIF format");
		console.error("Example: PRIVATE_KEY_WIF=your_private_key_wif bun run index.ts");
		process.exit(1);
	}
	
	// Validate the private key format
	try {
		return PrivateKey.fromWif(privateKeyWif);
	} catch (error) {
		console.error("\x1b[31mError: Invalid private key format\x1b[0m");
		console.error("The PRIVATE_KEY_WIF provided is not a valid Bitcoin SV private key in WIF format");
		console.error("Please check your key and try again");
		process.exit(1);
	}
}

// Validate private key early before starting the server
const privKey = validatePrivateKey();

const server = new McpServer({
	name: "Bitcoin SV MCP Server",
	version: "0.0.17",
});

// Initialize wallet with the validated private key
const wallet = new Wallet(privKey);

// Register wallet tools separately (needs wallet instance)
registerWalletTools(server, wallet);

// Register all other tools (BSV, Ordinals, Utils, etc.)
registerAllTools(server);

// Connect to the transport
const transport = new StdioServerTransport();
await server.connect(transport);
