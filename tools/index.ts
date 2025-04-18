import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBsvTools } from "./bsv";
import { registerMneeTools } from "./mnee";
import { registerOrdinalsTools } from "./ordinals";
import { registerUtilsTools } from "./utils";
import { registerA2bDiscoverTool } from "./a2b/discover";
import { registerA2aCallTool } from "./a2b/call";

/**
 * Register all tools with the MCP server
 * @param server The MCP server instance
 */
export function registerAllTools(server: McpServer): void {
	// Register BSV-related tools
	registerBsvTools(server);

	// Register Ordinals-related tools
	registerOrdinalsTools(server);

	// Register utility tools
	registerUtilsTools(server);

	// Register agent-to-blockchain discovery tool
	registerA2bDiscoverTool(server);

	// Register agent-to-agent call tool
	registerA2aCallTool(server);
	// Register MNEE tools
	registerMneeTools(server);

	// Add more tool categories as needed
}
