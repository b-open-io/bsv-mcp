import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOrdinalsPrompt } from "./ordinals";
import { registerAllBsvSdkPrompts } from "./bsvSdk";

/**
 * Register all prompts with the MCP server
 * @param server The MCP server instance
 */
export function registerAllPrompts(server: McpServer): void {
	// Register Ordinals prompt
	registerOrdinalsPrompt(server);

	// Register all BSV SDK prompts
	registerAllBsvSdkPrompts(server);

	// Add more prompts registration here as needed
}

/**
 * Export all prompt constants
 */
export * from "./ordinals";
export * from "./bsvSdk";
