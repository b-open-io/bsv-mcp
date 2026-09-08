import type { McpServer } from "@modelcontextprotocol/server";
import { registerChangelogResource } from "./changelog.js";
import { registerJungleBusResource } from "./junglebus.js";

/**
 * Register ordinary resources with the MCP server.
 * Static BRC/BitCom tutorial references were retired; skill discovery uses
 * utils_find_skills. The ui://bsv-mcp/app.html App resource is registered
 * separately and is not controlled here.
 * @param server The MCP server instance
 */
export function registerResources(server: McpServer): void {
	// Register changelog resource
	registerChangelogResource(server);

	// Register JungleBus API documentation resource
	registerJungleBusResource(server);

	// Add more resource categories here as needed
}
