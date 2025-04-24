import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBRCsResources } from "./brcs";

/**
 * Register all resources with the MCP server
 * @param server The MCP server instance
 */
export function registerResources(server: McpServer): void {
	// Register BRC-related resources
	registerBRCsResources(server);

	// Add more resource categories here as needed
}
