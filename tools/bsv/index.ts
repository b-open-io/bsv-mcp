import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDecodeTransactionTool } from "./decodeTransaction";
import { registerExploreTool } from "./explore";
import { registerGetPriceTool } from "./getPrice";

/**
 * Register all BSV tools with the MCP server
 * @param server The MCP server instance
 */
export function registerBsvTools(server: McpServer): void {
	// Register BSV-related tools
	registerGetPriceTool(server);
	registerDecodeTransactionTool(server);
	registerExploreTool(server);
}
