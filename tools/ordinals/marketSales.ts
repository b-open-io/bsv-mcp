import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

// Schema for unified market sales arguments
export const marketSalesArgsSchema = z.object({
	// Common parameters
	limit: z
		.number()
		.int()
		.min(1)
		.max(100)
		.default(20)
		.describe("Number of results (1-100, default 20)"),
	offset: z.number().int().min(0).default(0).describe("Pagination offset"),
	dir: z
		.enum(["asc", "desc"])
		.default("desc")
		.describe("Sort direction (asc or desc)"),
	address: z.string().optional().describe("Bitcoin address"),

	// Token-specific parameters
	tokenType: z
		.enum(["bsv20", "bsv21", "all"])
		.default("bsv20")
		.describe("Type of token to search for (bsv20, bsv21, or all)"),
	id: z.string().optional().describe("Token ID in outpoint format"),
	tick: z.string().optional().describe("Token ticker symbol"),
	pending: z
		.boolean()
		.default(false)
		.optional()
		.describe("Include pending sales"),
});

export type MarketSalesArgs = z.infer<typeof marketSalesArgsSchema>;

// Unified response type for token sales
interface MarketSaleResponse {
	results: Array<{
		outpoint: string;
		data?: {
			bsv20?: {
				id?: string;
				tick?: string;
				sym?: string;
				amt?: string;
				op?: string;
			};
			list?: {
				price?: number;
				payout?: string;
				sale?: boolean;
			};
		};
		satoshis?: number;
		height?: number;
		owner?: string;
		spend?: string;
		spendHeight?: number;
		spendIdx?: string;
		[key: string]: unknown;
	}>;
	total: number;
}

/**
 * Register the unified market sales tool
 * Handles BSV20 and BSV21 token sales
 */
export function registerMarketSalesTool(server: McpServer): void {
	server.tool(
		"ordinals_marketSales",
		"Retrieves recent sales data for BSV-20 and BSV-21 tokens on the ordinals marketplace. This tool provides insights into market activity, including sale prices, transaction details, and token information. Supports filtering by token ID, ticker symbol, or seller address to help analyze market trends and track specific token sales.",
		{
			args: marketSalesArgsSchema,
		},
		async ({ args }: { args: MarketSalesArgs }, extra: RequestHandlerExtra) => {
			try {
				const { limit, offset, dir, tokenType, id, tick, pending, address } =
					args;

				// Determine the API endpoint based on tokenType
				let baseUrl = "https://ordinals.gorillapool.io/api";

				// Default to BSV20 for all token types
				baseUrl += "/bsv20/market/sales";

				// Build the URL with query parameters
				const url = new URL(baseUrl);
				url.searchParams.append("limit", limit.toString());
				url.searchParams.append("offset", offset.toString());
				url.searchParams.append("dir", dir);

				// Add type parameter for bsv21 if needed
				if (tokenType === "bsv21") {
					url.searchParams.append("type", "v2");
				}

				if (id) url.searchParams.append("id", id);
				if (tick) url.searchParams.append("tick", tick);
				if (pending !== undefined)
					url.searchParams.append("pending", pending.toString());
				if (address) url.searchParams.append("address", address);

				// Fetch market sales from GorillaPool API
				const response = await fetch(url.toString());

				if (!response.ok) {
					throw new Error(
						`API error: ${response.status} ${response.statusText}`,
					);
				}

				const data = (await response.json()) as MarketSaleResponse;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(data, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: error instanceof Error ? error.message : String(error),
						},
					],
					isError: true,
				};
			}
		},
	);
}
