import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { BMAP_URL } from "../constants";

// Schema for reading follows from BMAP API
const bmapReadFollowsArgsSchema = z.object({
	bapId: z
		.string()
		.describe("BAP identity key to get follow relationships for"),
	type: z
		.enum(["followers", "following"])
		.default("following")
		.describe("Type of relationship to query"),
	limit: z
		.number()
		.min(1)
		.max(100)
		.default(20)
		.describe("Maximum number of follows to return"),
	page: z
		.number()
		.min(1)
		.default(1)
		.describe("Page number for pagination (1-based)"),
});

type BmapReadFollowsArgs = z.infer<typeof bmapReadFollowsArgsSchema>;

/**
 * Read follow relationships from BMAP API
 */
export async function readBmapFollows(args: BmapReadFollowsArgs): Promise<{
	success: boolean;
	data?: unknown;
	error?: string;
}> {
	try {
		const { bapId, type, limit, page } = args;

		const params = new URLSearchParams();
		params.append("limit", limit.toString());
		params.append("page", page.toString());

		const endpoint = type === "followers" ? "followers" : "following";
		const response = await fetch(
			`${BMAP_URL}/bap/${bapId}/${endpoint}?${params}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			},
		);

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
		console.error("Error reading BMAP follows:", errorMessage);
		return {
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Register the BMAP read follows tool with the MCP server
 */
export function registerBmapReadFollowsTool(server: McpServer) {
	server.tool(
		"bmap_readFollows",
		"Read follow relationships from the BMAP API. Shows who a user is following or who follows them.",
		{ args: bmapReadFollowsArgsSchema },
		async ({
			args,
		}: { args: BmapReadFollowsArgs }): Promise<CallToolResult> => {
			try {
				const result = await readBmapFollows(args);

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
