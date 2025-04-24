import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBRCsResources } from "./brcs";
import { registerChangelogResource } from "./changelog";

/**
 * Register all resources with the MCP server
 * @param server The MCP server instance
 */
export function registerResources(server: McpServer): void {
	// Register BRC-related resources
	registerBRCsResources(server);

	// Register changelog resource
	registerChangelogResource(server);

	// Add more resource categories here as needed
}
