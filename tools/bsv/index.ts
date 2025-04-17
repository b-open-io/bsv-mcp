import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDecodeTransactionTool } from "./decodeTransaction";
import { registerGetPriceTool } from "./getPrice";
import { registerExploreTool } from "./explore";

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
