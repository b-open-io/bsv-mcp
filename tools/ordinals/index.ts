import type { OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetInscriptionTool } from "./getInscription";
import { registerGetTokenByIdOrTickerTool } from "./getTokenByIdOrTicker";
import { registerMarketListingsTool } from "./marketListings";
import { registerMarketSalesTool } from "./marketSales";
import { registerSearchInscriptionsTool } from "./searchInscriptions";

/**
 * Register all Ordinals tools with the MCP server
 * @param server The MCP server instance
 * @param ctx OneSat context for SDK service access
 */
export function registerOrdinalsTools(server: McpServer, ctx?: OneSatContext): void {
	registerGetInscriptionTool(server);
	registerSearchInscriptionsTool(server);
	registerMarketListingsTool(server);
	registerMarketSalesTool(server);
	registerGetTokenByIdOrTickerTool(server, ctx);
}
