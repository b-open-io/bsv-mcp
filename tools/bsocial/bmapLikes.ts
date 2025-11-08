import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { BMAP_URL } from "../constants";

// Schema for reading likes from BMAP API
const bmapReadLikesArgsSchema = z.object({
	txid: z.string().describe("Transaction ID of the post to get likes for"),
	limit: z
		.number()
		.min(1)
		.max(100)
		.default(20)
		.describe("Maximum number of likes to return"),
	page: z
		.number()
		.min(1)
		.default(1)
		.describe("Page number for pagination (1-based)"),
});

type BmapReadLikesArgs = z.infer<typeof bmapReadLikesArgsSchema>;

/**
 * Read likes and reactions for a specific post from BMAP API
 */
export async function readBmapLikes(args: BmapReadLikesArgs): Promise<{
	success: boolean;
	data?: unknown;
	error?: string;
}> {
	try {
		const { txid, limit, page } = args;

		const params = new URLSearchParams();
		params.append("limit", limit.toString());
		params.append("page", page.toString());

		const response = await fetch(`${BMAP_URL}/post/${txid}/like?${params}`, {
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
		console.error("Error reading BMAP likes:", errorMessage);
		return {
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Register the BMAP read likes tool with the MCP server
 */
export function registerBmapReadLikesTool(server: McpServer) {
	server.tool(
		"bmap_readLikes",
		"Read likes and reactions for a specific post from the BMAP API. Shows who liked the post and what emoji reactions were used.",
		{ args: bmapReadLikesArgsSchema },
		async ({ args }: { args: BmapReadLikesArgs }): Promise<CallToolResult> => {
			try {
				const result = await readBmapLikes(args);

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
