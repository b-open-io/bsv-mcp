import type { OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Register the market listings tool (stub — awaiting 1sat-stack implementation)
 */
export function registerMarketListingsTool(
	server: McpServer,
	ctx?: OneSatContext,
): void {
	server.tool(
		"ordinals_marketListings",
		"Query marketplace listings for ordinals and tokens. Currently awaiting 1sat-stack marketplace API implementation.",
		{},
		async () => {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							error: "Marketplace listings API not yet available on 1sat-stack",
							status: "not_implemented",
						}),
					},
				],
				isError: true,
			};
		},
	);
}
