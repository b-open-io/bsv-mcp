import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

// Schema for BSV20 market sales arguments
export const bsv20MarketSalesArgsSchema = z.object({
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
	type: z
		.enum(["v1", "v2", "all"])
		.default("all")
		.describe("Token type (v1, v2, or all)"),
	id: z.string().optional().describe("Token ID in outpoint format"),
	tick: z.string().optional().describe("Token ticker symbol"),
	pending: z.boolean().default(false).describe("Include pending sales"),
	address: z.string().optional().describe("Bitcoin address"),
});

export type Bsv20MarketSalesArgs = z.infer<typeof bsv20MarketSalesArgsSchema>;

// Simplified BSV20 sale response type
interface Bsv20SaleResponse {
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
		[key: string]: unknown;
	}>;
	total: number;
}

/**
 * Register the BSV20 market sales tool
 */
export function registerBsv20MarketSalesTool(server: McpServer): void {
	server.tool(
		"ordinals_bsv20MarketSales",
		{
			args: bsv20MarketSalesArgsSchema,
		},
		async (
			{ args }: { args: Bsv20MarketSalesArgs },
			extra: RequestHandlerExtra,
		) => {
			try {
				const { limit, offset, dir, type, id, tick, pending, address } = args;

				// Build the URL with query parameters
				const url = new URL(
					"https://ordinals.gorillapool.io/api/bsv20/market/sales",
				);
				url.searchParams.append("limit", limit.toString());
				url.searchParams.append("offset", offset.toString());
				url.searchParams.append("dir", dir);
				url.searchParams.append("type", type);
				url.searchParams.append("pending", pending.toString());

				if (id) url.searchParams.append("id", id);
				if (tick) url.searchParams.append("tick", tick);
				if (address) url.searchParams.append("address", address);

				// Fetch BSV20 market sales from GorillaPool API
				const response = await fetch(url.toString());

				if (!response.ok) {
					throw new Error(
						`API error: ${response.status} ${response.statusText}`,
					);
				}

				const data = (await response.json()) as Bsv20SaleResponse;

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
