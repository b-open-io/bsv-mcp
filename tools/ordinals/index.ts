import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetInscriptionTool } from "./getInscription";
import { registerGetTokenByIdOrTickerTool } from "./getTokenByIdOrTicker";
import { registerMarketListingsTool } from "./marketListings";
import { registerMarketSalesTool } from "./marketSales";
import { registerSearchInscriptionsTool } from "./searchInscriptions";

/**
 * Register all Ordinals tools with the MCP server
 * @param server The MCP server instance
 */
export function registerOrdinalsTools(server: McpServer): void {
	// Register Ordinals-related tools
	registerGetInscriptionTool(server);
	registerSearchInscriptionsTool(server);
	registerMarketListingsTool(server);
	registerMarketSalesTool(server);
	registerGetTokenByIdOrTickerTool(server);
}
