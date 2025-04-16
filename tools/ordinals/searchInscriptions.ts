import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

// Schema for search inscriptions arguments
export const searchInscriptionsArgsSchema = z.object({
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
	num: z.string().optional().describe("Inscription number"),
	origin: z.string().optional().describe("Origin outpoint"),
	address: z.string().optional().describe("Bitcoin address"),
	map: z.string().optional().describe("Map field"),
	terms: z.string().optional().describe("Search terms"),
	mime: z.string().optional().describe("MIME type filter"),
});

export type SearchInscriptionsArgs = z.infer<
	typeof searchInscriptionsArgsSchema
>;

// Simplified inscription response type
interface InscriptionSearchResponse {
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
		height?: number;
		satoshis?: number;
		[key: string]: unknown;
	}>;
	total: number;
}

/**
 * Register the Ordinals search inscriptions tool
 */
export function registerSearchInscriptionsTool(server: McpServer): void {
	server.tool(
		"ordinals_searchInscriptions",
		"Searches for Bitcoin SV ordinal inscriptions using flexible criteria. This powerful search tool supports filtering by address, inscription content, MIME type, MAP fields, and other parameters. Results include detailed information about each matched inscription. Ideal for discovering NFTs and exploring the ordinals ecosystem.",
		{
			args: searchInscriptionsArgsSchema,
		},
		async (
			{ args }: { args: SearchInscriptionsArgs },
			extra: RequestHandlerExtra,
		) => {
			try {
				const { limit, offset, dir, num, origin, address, map, terms, mime } =
					args;

				// Build the URL with query parameters
				const url = new URL(
					"https://ordinals.gorillapool.io/api/inscriptions/search",
				);
				url.searchParams.append("limit", limit.toString());
				url.searchParams.append("offset", offset.toString());
				url.searchParams.append("dir", dir);

				if (num) url.searchParams.append("num", num);
				if (origin) url.searchParams.append("origin", origin);
				if (address) url.searchParams.append("address", address);
				if (map) url.searchParams.append("map", map);
				if (terms) url.searchParams.append("terms", terms);
				if (mime) url.searchParams.append("mime", mime);

				// Fetch inscriptions data from GorillaPool API
				const response = await fetch(url.toString());

				if (!response.ok) {
					throw new Error(
						`API error: ${response.status} ${response.statusText}`,
					);
				}

				const data = (await response.json()) as InscriptionSearchResponse;

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
