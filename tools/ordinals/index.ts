import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBsv20MarketSalesTool } from "./bsv20MarketSales";
import { registerGetBsv20ByIdTool } from "./getBsv20ById";
import { registerGetInscriptionTool } from "./getInscription";
import { registerMarketListingsTool } from "./marketListings";
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
	registerBsv20MarketSalesTool(server);
	registerGetBsv20ByIdTool(server);
}
