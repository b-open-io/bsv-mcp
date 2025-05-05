import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBitcomResource } from "./bitcom.js";
import { registerBRCsResources } from "./brcs.js";
import { registerChangelogResource } from "./changelog.js";
import { registerJungleBusResource } from "./junglebus.js";

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

	// Register Bitcom resource
	registerBitcomResource(server);

	// Add more resource categories here as needed
}
