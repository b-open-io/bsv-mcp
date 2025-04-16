import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

// Schema for market listings arguments
export const marketListingsArgsSchema = z.object({
	limit: z
		.number()
		.int()
		.min(1)
		.max(100)
		.default(20)
		.describe("Number of results (1-100, default 20)"),
	offset: z.number().int().min(0).default(0).describe("Pagination offset"),
	sort: z
		.enum(["recent", "price", "num"])
		.default("recent")
		.describe("Sort method (recent, price, or num)"),
	dir: z
		.enum(["asc", "desc"])
		.default("desc")
		.describe("Sort direction (asc or desc)"),
	address: z.string().optional().describe("Bitcoin address"),
	origin: z.string().optional().describe("Origin outpoint"),
	mime: z.string().optional().describe("MIME type filter"),
	num: z.string().optional().describe("Inscription number"),
	minPrice: z.number().optional().describe("Minimum price in satoshis"),
	maxPrice: z.number().optional().describe("Maximum price in satoshis"),
});

export type MarketListingsArgs = z.infer<typeof marketListingsArgsSchema>;

// Simplified market listing response type
interface MarketListingResponse {
	results: Array<{
		outpoint: string;
		origin: {
			outpoint: string;
			data?: {
				insc?: {
					text?: string;
					file?: {
						type?: string;
						size?: number;
					};
				};
			};
		};
		data?: {
			list?: {
				price?: number;
				payout?: string;
				sale?: boolean;
			};
		};
		satoshis?: number;
		[key: string]: unknown;
	}>;
	total: number;
}

/**
 * Register the Ordinals market listings tool
 */
export function registerMarketListingsTool(server: McpServer): void {
	server.tool(
		"ordinals_marketListings",
		{
			args: marketListingsArgsSchema,
		},
		async (
			{ args }: { args: MarketListingsArgs },
			extra: RequestHandlerExtra,
		) => {
			try {
				const {
					limit,
					offset,
					sort,
					dir,
					address,
					origin,
					mime,
					num,
					minPrice,
					maxPrice,
				} = args;

				// Build the URL with query parameters
				const url = new URL("https://ordinals.gorillapool.io/api/market");
				url.searchParams.append("limit", limit.toString());
				url.searchParams.append("offset", offset.toString());
				url.searchParams.append("sort", sort);
				url.searchParams.append("dir", dir);

				if (address) url.searchParams.append("address", address);
				if (origin) url.searchParams.append("origin", origin);
				if (mime) url.searchParams.append("mime", mime);
				if (num) url.searchParams.append("num", num);
				if (minPrice !== undefined)
					url.searchParams.append("min", minPrice.toString());
				if (maxPrice !== undefined)
					url.searchParams.append("max", maxPrice.toString());

				// Fetch market listings from GorillaPool API
				const response = await fetch(url.toString());

				if (!response.ok) {
					throw new Error(
						`API error: ${response.status} ${response.statusText}`,
					);
				}

				const data = (await response.json()) as MarketListingResponse;

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
