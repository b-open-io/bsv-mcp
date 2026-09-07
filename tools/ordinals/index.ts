import type { OneSatServices } from "@1sat/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readServices } from "../../utils/backends";
import { registerGetInscriptionTool } from "./getInscription";
import { registerGetTokenByIdOrTickerTool } from "./getTokenByIdOrTicker";
import { registerMarketListingsTool } from "./marketListings";
import { registerMarketSalesTool } from "./marketSales";
import { registerSearchInscriptionsTool } from "./searchInscriptions";

/**
 * Register all Ordinals tools with the MCP server
 * @param server The MCP server instance
 * @param configuredServices Existing SDK clients, or environment-configured read clients
 */
export function registerOrdinalsTools(
	server: McpServer,
	configuredServices?: OneSatServices,
): void {
	const services = readServices(configuredServices);
	registerGetInscriptionTool(server, services);
	registerSearchInscriptionsTool(server, services);
	registerMarketListingsTool(server, services);
	registerMarketSalesTool(server, services);
	registerGetTokenByIdOrTickerTool(server, services);
}
