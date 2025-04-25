import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBRCsResources } from "./brcs";
import { registerChangelogResource } from "./changelog";
import { registerJungleBusResource } from "./junglebus";

/**
 * Register all resources with the MCP server
 * @param server The MCP server instance
 */
export function registerResources(server: McpServer): void {
	// Register BRC-related resources
	registerBRCsResources(server);

	// Register changelog resource
	registerChangelogResource(server);

	// Register JungleBus API documentation resource
	registerJungleBusResource(server);

	// Add more resource categories here as needed
}
