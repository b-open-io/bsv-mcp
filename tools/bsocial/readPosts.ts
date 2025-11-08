import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type {
	ApiResponse,
	BapIdentity,
	PostMeta,
	PostResponse,
	PostTransaction,
	PostsResponse,
} from "bmap-api-types";
import { z } from "zod";
import { BMAP_URL } from "../constants";

// Schema for reading posts
const readPostsArgsSchema = z.object({
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
});

type ReadPostsArgs = z.infer<typeof readPostsArgsSchema>;

/**
 * Read social posts from the BMAP API using official types
 */
export async function readSocialPosts(args: ReadPostsArgs): Promise<{
	success: boolean;
	posts?: PostTransaction[];
	signers?: BapIdentity[];
	meta?: PostMeta[];
	pagination?: {
		page: number;
		limit: number;
		count: number;
	};
	error?: string;
}> {
	try {
		const { bapId, txid, limit, page, feed } = args;

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

			const data = (await response.json()) as ApiResponse<PostResponse>;

			if (data.status !== "success") {
				return {
					success: false,
					error: data.error || "Unknown API error",
				};
			}

			return {
				success: true,
				posts: [data.result.post],
				signers: data.result.signers,
				meta: [data.result.meta],
			};
		}

		// Handle posts list request
		const params = new URLSearchParams();
		if (bapId) params.append("bapId", bapId);
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

		const data = (await response.json()) as ApiResponse<PostsResponse>;

		if (data.status !== "success") {
			return {
				success: false,
				error: data.error || "Unknown API error",
			};
		}

		return {
			success: true,
			posts: data.data.results,
			signers: data.data.signers,
			meta: data.data.meta,
			pagination: {
				page: data.data.page,
				limit: data.data.limit,
				count: data.data.count,
			},
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("Error reading social posts:", errorMessage);
		return {
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Format a post transaction for display
 */
function formatPost(
	post: PostTransaction,
	index: number,
	signer?: BapIdentity,
	meta?: PostMeta,
): string {
	const lines = [
		`Post ${index + 1}:`,
		`  TX ID: ${post.tx.h}`,
		`  Content: ${post.B[0]?.content || "[No Content]"}`,
		`  Content Type: ${post.B[0]?.["content-type"] || "text/plain"}`,
		`  Timestamp: ${new Date(post.timestamp * 1000).toISOString()}`,
	];

	// Add signer information
	if (signer) {
		lines.push(`  Author: ${signer.displayName || signer.idKey}`);
		if (signer.paymail) {
			lines.push(`  Paymail: ${signer.paymail}`);
		}
	}

	// Add MAP data
	const mapData = post.MAP.find((m) => m.type === "post");
	if (mapData?.app) {
		lines.push(`  App: ${mapData.app}`);
	}

	// Add metadata
	if (meta) {
		if (meta.likes > 0) {
			lines.push(`  Likes: ${meta.likes}`);
		}
		if (meta.replies > 0) {
			lines.push(`  Replies: ${meta.replies}`);
		}
		if (meta.reactions.length > 0) {
			const reactions = meta.reactions
				.map((r) => `${r.emoji}(${r.count})`)
				.join(" ");
			lines.push(`  Reactions: ${reactions}`);
		}
	}

	return lines.join("\n");
}

/**
 * Register the read posts tool with the MCP server
 */
export function registerReadPostsTool(server: McpServer) {
	server.tool(
		"bsocial_readPosts",
		"Read social posts from the BSV blockchain using BMAP API. Can fetch posts by author (BAP ID), specific post by transaction ID, or recent posts from all users. Supports pagination and feed functionality.",
		{ args: readPostsArgsSchema },
		async ({ args }: { args: ReadPostsArgs }): Promise<CallToolResult> => {
			try {
				const result = await readSocialPosts(args);

				if (result.success && result.posts) {
					// Format posts for display
					const formattedPosts = result.posts
						.map((post, index) => {
							const signer = result.signers?.find(
								(s) => s.currentAddress === post.AIP[0]?.address,
							);
							const meta = result.meta?.[index];
							return formatPost(post, index, signer, meta);
						})
						.join("\n\n");

					let output =
						result.posts.length > 0 ? formattedPosts : "No posts found";

					// Add pagination info
					if (result.pagination) {
						output += `\n\nPagination: Page ${result.pagination.page}, showing ${result.posts.length} of ${result.pagination.count} posts`;
					}

					return {
						content: [
							{
								type: "text",
								text: output,
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
