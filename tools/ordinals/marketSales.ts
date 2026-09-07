import type { OneSatServices } from "@1sat/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorToToolResult, successResult } from "../../utils/errors";
import { marketSearchSchema } from "./marketListings";

export function registerMarketSalesTool(
	server: McpServer,
	services: OneSatServices,
): void {
	server.registerTool(
		"ordinals_marketSales",
		{
			description:
				"Query completed 1Sat marketplace sales by name prefix or content type. Prices are satoshis. Pass the last score as from for the next page.",
			inputSchema: marketSearchSchema,
			annotations: {
				readOnlyHint: true,
				idempotentHint: true,
				openWorldHint: true,
			},
		},
		async (args) => {
			try {
				const sales = await services.market.searchListings({
					...args,
					status: "sale",
					rev: true,
				});
				const data = {
					sales,
					nextFrom: sales.length === args.limit ? sales.at(-1)?.score : null,
				};
				return { ...successResult(data), structuredContent: data };
			} catch (error) {
				return errorToToolResult(error);
			}
		},
	);
}
