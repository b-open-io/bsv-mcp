import type { OneSatServices } from "@1sat/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorToToolResult, successResult } from "../../utils/errors";

export const marketSearchSchema = {
	q: z
		.string()
		.trim()
		.min(1)
		.max(200)
		.optional()
		.describe("Listing name prefix"),
	type: z.string().max(100).optional().describe("Content type, e.g. image/png"),
	limit: z.number().int().min(1).max(100).default(20),
	from: z
		.number()
		.finite()
		.nonnegative()
		.optional()
		.describe("Last result's score for the next page"),
};

export function registerMarketListingsTool(
	server: McpServer,
	services: OneSatServices,
): void {
	server.registerTool(
		"ordinals_marketListings",
		{
			description:
				"Search active 1Sat marketplace listings by name prefix or content type. Prices are satoshis. Pass the last score as from for the next page. Availability is checked again when purchasing.",
			inputSchema: marketSearchSchema,
			annotations: {
				readOnlyHint: true,
				idempotentHint: true,
				openWorldHint: true,
			},
		},
		async (args) => {
			try {
				const listings = await services.market.searchListings({
					...args,
					status: "active",
					rev: true,
				});
				const data = {
					listings,
					nextFrom:
						listings.length === args.limit ? listings.at(-1)?.score : null,
				};
				return { ...successResult(data), structuredContent: data };
			} catch (error) {
				return errorToToolResult(error);
			}
		},
	);
}
