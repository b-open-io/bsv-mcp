import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { BMAP_URL } from "../constants";

// Schema for reading posts from BMAP API
const bmapReadPostsArgsSchema = z.object({
	bapId: z
		.string()
		.optional()
		.describe("BAP identity key to filter posts by author"),
	txid: z.string().optional().describe("Specific transaction ID to fetch"),
	limit: z
		.number()
		.min(1)
		.max(100)
		.default(20)
		.describe("Maximum number of posts to return"),
	page: z
		.number()
		.min(1)
		.default(1)
		.describe("Page number for pagination (1-based)"),
	feed: z
		.boolean()
		.default(false)
		.describe("Whether to fetch feed (posts from followed users)"),
	address: z.string().optional().describe("Bitcoin address to filter posts by"),
});

type BmapReadPostsArgs = z.infer<typeof bmapReadPostsArgsSchema>;

/**
 * Read social posts from the BMAP API (the query/read layer)
 */
export async function readBmapPosts(args: BmapReadPostsArgs): Promise<{
	success: boolean;
	data?: unknown;
	error?: string;
}> {
	try {
		const { bapId, txid, limit, page, feed, address } = args;

		// Handle single post request
		if (txid) {
			const response = await fetch(`${BMAP_URL}/post/${txid}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				return {
					success: false,
					error: `BMAP API request failed: ${response.status} ${errorText}`,
				};
			}

			const data = await response.json();
			return {
				success: true,
				data,
			};
		}

		// Handle posts list request
		const params = new URLSearchParams();
		if (bapId) params.append("bapId", bapId);
		if (address) params.append("address", address);
		params.append("limit", limit.toString());
		params.append("page", page.toString());
		if (feed) params.append("feed", "true");

		const response = await fetch(`${BMAP_URL}/posts?${params}`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			return {
				success: false,
				error: `BMAP API request failed: ${response.status} ${errorText}`,
			};
		}

		const data = await response.json();
		return {
			success: true,
			data,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("Error reading BMAP posts:", errorMessage);
		return {
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Register the BMAP read posts tool with the MCP server
 */
export function registerBmapReadPostsTool(server: McpServer) {
	server.tool(
		"bmap_readPosts",
		"Read social posts from the BMAP API (query layer). Can fetch posts by author (BAP ID), specific post by transaction ID, or recent posts from all users. Supports pagination and feed functionality.",
		{ args: bmapReadPostsArgsSchema },
		async ({ args }: { args: BmapReadPostsArgs }): Promise<CallToolResult> => {
			try {
				const result = await readBmapPosts(args);

				if (result.success) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(result.data, null, 2),
							},
						],
						isError: false,
					};
				}

				return {
					content: [
						{
							type: "text",
							text: result.error || "Unknown error occurred",
						},
					],
					isError: true,
				};
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `Error: ${msg}` }],
					isError: true,
				};
			}
		},
	);
}
