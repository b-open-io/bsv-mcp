#!/usr/bin/env bun
import { PrivateKey } from "@bsv/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools";
import { registerWalletTools } from "./tools/wallet/tools";
import { Wallet } from "./tools/wallet/wallet";

const server = new McpServer({
	name: "Bitcoin SV MCP",
	version: "0.0.1",
});

// Singleton wallet instance (for demo, could be replaced with real key management)
// If PRIVATE_KEY_WIF is set in the environment, use it to instantiate the Wallet
const privateKeyWif = process.env.PRIVATE_KEY_WIF;
const privKey = privateKeyWif ? PrivateKey.fromWif(privateKeyWif) : undefined;
const wallet = privKey ? new Wallet(privKey) : new Wallet();

// Register wallet tools separately (needs wallet instance)
registerWalletTools(server, wallet);

// Register all other tools (BSV, Ordinals, Utils, etc.)
registerAllTools(server);

// Debug: Log all registered tools
console.log("Registered tools:", Object.keys(server));
console.log("MCP Server:", server);

// Connect to the transport
const transport = new StdioServerTransport();
await server.connect(transport);
