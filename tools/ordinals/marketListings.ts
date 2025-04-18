import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

// Enhanced schema for unified market listings arguments
export const marketListingsArgsSchema = z.object({
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

	// NFT-specific parameters
	origin: z.string().optional().describe("Origin outpoint"),
	mime: z.string().optional().describe("MIME type filter"),
	num: z.string().optional().describe("Inscription number"),

	// General market parameters
	minPrice: z.number().optional().describe("Minimum price in satoshis"),
	maxPrice: z.number().optional().describe("Maximum price in satoshis"),

	// Token-specific parameters
	tokenType: z
		.enum(["nft", "bsv20", "bsv21", "all"])
		.default("all")
		.describe("Type of token to search for (nft, bsv20, bsv21, or all)"),
	sort: z
		.enum(["recent", "price", "num", "height", "price_per_token"])
		.default("recent")
		.describe("Sort method (recent, price, num, height, price_per_token)"),
	id: z.string().optional().describe("Token ID in outpoint format"),
	tick: z.string().optional().describe("Token ticker symbol"),
	pending: z
		.boolean()
		.default(false)
		.optional()
		.describe("Include pending sales"),
});

export type MarketListingsArgs = z.infer<typeof marketListingsArgsSchema>;

// Unified response type that covers all token types
interface MarketListingResponse {
	results: Array<{
		outpoint: string;
		origin?: {
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
				price_per_token?: number;
			};
			bsv20?: {
				id?: string;
				tick?: string;
				sym?: string;
				amt?: string;
				op?: string;
			};
		};
		satoshis?: number;
		height?: number;
		[key: string]: unknown;
	}>;
	total: number;
}

/**
 * Register the unified Ordinals market listings tool
 * Handles NFTs, BSV20, and BSV21 tokens
 */
export function registerMarketListingsTool(server: McpServer): void {
	server.tool(
		"ordinals_marketListings",
		"Retrieves current marketplace listings for Bitcoin SV ordinals with flexible filtering. Supports multiple asset types (NFTs, BSV-20 tokens, BSV-21 tokens) through a unified interface. Results include listing prices, details about the assets, and seller information.",
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
					tokenType,
					id,
					tick,
					pending,
				} = args;

				// Determine the API endpoint based on tokenType
				let baseUrl = "https://ordinals.gorillapool.io/api";
				let useTokenParams = false;

				if (tokenType === "bsv20" || tokenType === "bsv21") {
					baseUrl += "/bsv20/market";
					useTokenParams = true;
				} else if (tokenType === "nft" || tokenType === "all") {
					baseUrl += "/market";
				}

				// Build the URL with query parameters
				const url = new URL(baseUrl);
				url.searchParams.append("limit", limit.toString());
				url.searchParams.append("offset", offset.toString());
				url.searchParams.append("dir", dir);

				// Add sort parameter based on token type
				if (useTokenParams) {
					// BSV20/BSV21 specific sort options
					if (
						sort === "height" ||
						sort === "price" ||
						sort === "price_per_token"
					) {
						url.searchParams.append("sort", sort);
					}
					// Add token-specific parameters
					if (tokenType === "bsv21") {
						url.searchParams.append("type", "v2");
					}
					if (id) url.searchParams.append("id", id);
					if (tick) url.searchParams.append("tick", tick);
					if (pending !== undefined)
						url.searchParams.append("pending", pending.toString());
					// For BSV20/21, min/max price parameters have slightly different names
					if (minPrice !== undefined)
						url.searchParams.append("min_price", minPrice.toString());
					if (maxPrice !== undefined)
						url.searchParams.append("max_price", maxPrice.toString());
				} else {
					// NFT specific sort options
					if (sort === "recent" || sort === "price" || sort === "num") {
						url.searchParams.append("sort", sort);
					}
					// Add NFT-specific parameters
					if (origin) url.searchParams.append("origin", origin);
					if (mime) url.searchParams.append("mime", mime);
					if (num) url.searchParams.append("num", num);
					// For NFTs, min/max price parameters use short names
					if (minPrice !== undefined)
						url.searchParams.append("min", minPrice.toString());
					if (maxPrice !== undefined)
						url.searchParams.append("max", maxPrice.toString());
				}

				// Add common parameters
				if (address) url.searchParams.append("address", address);

				// Make the fetch request
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
