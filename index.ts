#!/usr/bin/env bun
import { PrivateKey } from "@bsv/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllPrompts } from "./prompts/index.ts";
import { registerResources } from "./resources/resources.ts";
import { registerAllTools } from "./tools/index.ts";
import { registerMneeTools } from "./tools/mnee/index.ts";
import { registerWalletTools } from "./tools/wallet/tools.ts";
import { Wallet } from "./tools/wallet/wallet.ts";

/**
 * Configuration options from environment variables
 */
const CONFIG = {
	// Whether to load various components
	loadPrompts: process.env.DISABLE_PROMPTS !== "true",
	loadResources: process.env.DISABLE_RESOURCES !== "true",
	loadTools: process.env.DISABLE_TOOLS !== "true",

	// Fine-grained tool category control
	loadWalletTools: process.env.DISABLE_WALLET_TOOLS !== "true",
	loadMneeTools: process.env.DISABLE_MNEE_TOOLS !== "true",
	loadBsvTools: process.env.DISABLE_BSV_TOOLS !== "true",
	loadOrdinalsTools: process.env.DISABLE_ORDINALS_TOOLS !== "true",
	loadUtilsTools: process.env.DISABLE_UTILS_TOOLS !== "true",
	loadA2bTools: process.env.ENABLE_A2B_TOOLS === "true",

	// Transaction broadcasting control
	disableBroadcasting: process.env.DISABLE_BROADCASTING === "true",
};

/**
 * Try to initialize the private key from environment variables
 * Returns the private key if valid, or undefined if not present or invalid
 */
function initializePrivateKey(): PrivateKey | undefined {
	const privateKeyWif = process.env.PRIVATE_KEY_WIF;

	// Check if private key is set
	if (!privateKeyWif) {
		// stdio protocol you cant send anything to console!!
		// console.warn(
		// 	"\x1b[33mWarning: PRIVATE_KEY_WIF environment variable is not set\x1b[0m",
		// );
		// console.warn(
		// 	"The server will run, but wallet operations requiring a private key will return errors.",
		// );
		// console.warn(
		// 	"Set this variable with a valid Bitcoin SV private key in WIF format to enable all features:",
		// );
		// console.warn(
		// 	"Example: PRIVATE_KEY_WIF=your_private_key_wif bun run index.ts",
		// );
		return undefined;
	}

	// Validate the private key format
	try {
		return PrivateKey.fromWif(privateKeyWif);
	} catch (error) {
		// console.warn("\x1b[33mWarning: Invalid private key format\x1b[0m");
		// console.warn(
		// 	"The PRIVATE_KEY_WIF provided is not a valid Bitcoin SV private key in WIF format.",
		// );
		// console.warn(
		// 	"The server will run, but wallet operations requiring a private key will return errors.",
		// );
		return undefined;
	}
}

// Try to initialize private key but don't stop the server if missing or invalid
const privKey = initializePrivateKey();

const server = new McpServer(
	{ name: "Bitcoin SV", version: "0.0.36" },
	{
		capabilities: {
			prompts: {},
			resources: {},
			tools: {},
		},
		instructions: `
			This server exposes Bitcoin SV helpers.
			Tools are idempotent unless marked destructive.
		`,
	},
);

// Initialize wallet and register tools based on configuration
let wallet: Wallet | null = null;

if (CONFIG.loadTools) {
	if (privKey) {
		// Register MNEE tools if enabled
		if (CONFIG.loadMneeTools) {
			registerMneeTools(server);
		}

		// Initialize wallet with the private key if wallet tools are enabled
		if (CONFIG.loadWalletTools) {
			wallet = new Wallet(privKey);
			registerWalletTools(server, wallet, {
				disableBroadcasting: CONFIG.disableBroadcasting,
				enableA2bTools: CONFIG.loadA2bTools,
			});
		}
	}

	// Register all other tools based on configuration
	registerAllTools(server, {
		enableBsvTools: CONFIG.loadBsvTools,
		enableOrdinalsTools: CONFIG.loadOrdinalsTools,
		enableUtilsTools: CONFIG.loadUtilsTools,
		enableA2bTools: CONFIG.loadA2bTools,
	});
}

// Register resources if enabled
if (CONFIG.loadResources) {
	registerResources(server);
}

// Register prompts if enabled
if (CONFIG.loadPrompts) {
	registerAllPrompts(server);
}

// Connect to the transport
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("BSV MCP Server running on stdio");
