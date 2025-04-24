#!/usr/bin/env bun
import { PrivateKey } from "@bsv/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllPrompts } from "./prompts";
import { registerResources } from "./resources/resources";
import { registerAllTools } from "./tools";
import { registerWalletTools } from "./tools/wallet/tools";
import { Wallet } from "./tools/wallet/wallet";
import { registerMneeTools } from "./tools/mnee";

/**
 * Try to initialize the private key from environment variables
 * Returns the private key if valid, or undefined if not present or invalid
 */
function initializePrivateKey(): PrivateKey | undefined {
	const privateKeyWif = process.env.PRIVATE_KEY_WIF;

	// Check if private key is set
	if (!privateKeyWif) {
		console.warn(
			"\x1b[33mWarning: PRIVATE_KEY_WIF environment variable is not set\x1b[0m",
		);
		console.warn(
			"The server will run, but wallet operations requiring a private key will return errors.",
		);
		console.warn(
			"Set this variable with a valid Bitcoin SV private key in WIF format to enable all features:",
		);
		console.warn(
			"Example: PRIVATE_KEY_WIF=your_private_key_wif bun run index.ts",
		);
		return undefined;
	}

	// Validate the private key format
	try {
		return PrivateKey.fromWif(privateKeyWif);
	} catch (error) {
		console.warn("\x1b[33mWarning: Invalid private key format\x1b[0m");
		console.warn(
			"The PRIVATE_KEY_WIF provided is not a valid Bitcoin SV private key in WIF format.",
		);
		console.warn(
			"The server will run, but wallet operations requiring a private key will return errors.",
		);
		return undefined;
	}
}

// Try to initialize private key but don't stop the server if missing or invalid
const privKey = initializePrivateKey();

const server = new McpServer(
	{ name: "Bitcoin SV", version: "0.0.25" },
	// {
	// 	// Advertise only what you actually implement
	// 	capabilities: {
	// 		completions: {},
	// 		experimental: {},
	// 		logging: {},
	// 		prompts: {},
	// 		resources: {},
	// 		tools: {},
	// 	},
	// 	// Optional instructions banner for clients
	// 	instructions: `
	// 		This server exposes Bitcoin SV helpers.
	// 		Tools are idempotent unless marked destructive.
	// 	`,
	// },
);

// Initialize wallet with the validated private key only if available
let wallet: Wallet | null = null;
if (privKey) {
  	// Register MNEE tools
	registerMneeTools(server);
  // Initialize wallet with the private key
	wallet = new Wallet(privKey);
  // Register wallet tools
  registerWalletTools(server, wallet);
}

// Register all other tools (BSV, Ordinals, Utils, etc.)
registerAllTools(server);

// Register resources
registerResources(server);

// Register prompts
registerAllPrompts(server);

// Connect to the transport
const transport = new StdioServerTransport();
await server.connect(transport);
