import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// API endpoint for the A2B Overlay service
const OVERLAY_API_URL = "https://a2b-overlay-production.up.railway.app/v1";

type A2BDiscoveryItem = {
	txid: string;
	outpoint: string;
	type: "agent" | "tool";
	app: string;
	serverName: string;
	command: string;
	description: string;
	keywords: string[];
	args: Record<string, string>;
	env: Record<string, string>;
	blockHeight: number;
	timestamp: string;
	tools?: string[];
	prompts?: string[];
	resources?: string[];
};

type OverlaySearchResponse = {
	items: A2BDiscoveryItem[];
	total: number;
	limit: number;
	offset: number;
	queryType: "agent" | "tool" | "all";
	query: string;
};

// Schema for agent discovery parameters
export const a2bDiscoverArgsSchema = z.object({
	queryType: z.enum(["agent", "tool"]).describe("Type of discovery to perform"),
	query: z.string().describe("Search agent or tool names, descriptions"),
	limit: z.number().optional().describe("Limit the number of results"),
	offset: z.number().optional().describe("Offset the results"),
	fromBlock: z.number().optional().describe("From block"),
	toBlock: z.number().optional().describe("To block"),
});
export type A2bDiscoverArgs = z.infer<typeof a2bDiscoverArgsSchema>;

/**
 * Format the response in a user-friendly way
 */
function formatSearchResults(data: unknown, queryType: string): string {
	// console.log(`Received data: ${JSON.stringify(data).substring(0, 200)}...`); // Debug log

	// Check if data is an object with items property
	if (!data) {
		return `No ${queryType} results found.`;
	}

	// Handle the new API format where data is an object with 'items' array
	const items = Array.isArray(data)
		? data
		: (data as { items?: A2BDiscoveryItem[] }).items;

	// Ensure items is an array
	if (!items || !Array.isArray(items) || items.length === 0) {
		return `No ${queryType} results found.`;
	}

	let result = `Found ${items.length} ${queryType === "all" ? "items" : `${queryType}s`}:\n\n`;

	items.forEach((item, index) => {
		if (!item) return;

		// Agent or MCP server name with description
		result += `${index + 1}. **${item.serverName || "Unknown"}** - ${item.description || "No description"}\n`;

		// Display command to run
		if (item.command) {
			const args = item.args ? Object.values(item.args).join(" ") : "";
			result += `   Command: \`${item.command} ${args}\`\n`;
		}

		// Add tools count if available
		if (item.tools && Array.isArray(item.tools)) {
			result += `   Tools: ${item.tools.length} available\n`;
		}

		// Add keywords if available
		if (
			item.keywords &&
			Array.isArray(item.keywords) &&
			item.keywords.length > 0
		) {
			result += `   Keywords: ${item.keywords.join(", ")}\n`;
		}

		// Add blockchain details
		if (item.outpoint) {
			result += `   Outpoint: ${item.outpoint}\n`;
		}

		if (item.blockHeight !== undefined) {
			const date = item.timestamp
				? new Date(item.timestamp).toLocaleDateString()
				: "Unknown date";
			result += `   Block: ${item.blockHeight}, ${date}\n`;
		}

		result += "\n";
	});

	return result;
}

/**
 * Registers the a2b_discover tool for on-chain agent discovery
 */
export function registerA2bDiscoverTool(server: McpServer) {
	server.tool(
		"a2b_discover",
		"Search on-chain agent and MCP tool records. Use 'agent' to search for agents, 'tool' to search for MCP tools.",
		{ args: a2bDiscoverArgsSchema },
		async (
			{ args }: { args: A2bDiscoverArgs },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		) => {
			try {
				const params = new URLSearchParams();

				// Set query type (agent, tool, or all)
				params.set("type", args.queryType);

				// Use enhanced search for better relevance scoring
				let searchEndpoint = "/search/enhanced";

				// For empty queries, use the regular search endpoint
				if (!args.query || !args.query.trim()) {
					searchEndpoint = "/search";
				} else {
					params.set("q", args.query); // enhanced search uses 'q' parameter
				}

				// Add pagination parameters
				params.set("limit", args.limit?.toString() ?? "10");
				params.set("offset", args.offset?.toString() ?? "0");

				// Add block range if specified
				if (args.fromBlock) {
					params.set("fromBlock", args.fromBlock.toString());
				}
				if (args.toBlock) {
					params.set("toBlock", args.toBlock.toString());
				}

				// Construct the full URL
				const searchUrl = `${OVERLAY_API_URL}${searchEndpoint}?${params.toString()}`;
				//console.log(`Searching URL: ${searchUrl}`);

				// Make the request to the overlay API
				const response = await fetch(searchUrl, {
					method: "GET",
					headers: {
						Accept: "application/json",
					},
				});

				if (!response.ok) {
					throw new Error(
						`API returned status ${response.status}: ${response.statusText}`,
					);
				}

				const data = (await response.json()) as OverlaySearchResponse;

				// Format the results for better readability
				let result = "";

				if (data?.items?.length > 0) {
					result = `Found ${data.items.length} ${args.queryType}(s):\n\n`;

					data.items.forEach((item: A2BDiscoveryItem, index: number) => {
						// Server name and description
						result += `${index + 1}. **${item.serverName || "Unknown"}** - ${item.description || "No description"}\n`;

						// Command to run
						if (item.command) {
							const cmdArgs = item.args
								? Object.values(item.args).join(" ")
								: "";
							result += `   Command: \`${item.command} ${cmdArgs}\`\n`;
						}

						// Tools available
						if (item.tools?.length) {
							result += `   Tools: ${item.tools.length} available\n`;
						}

						// Keywords
						if (item.keywords?.length) {
							result += `   Keywords: ${item.keywords.join(", ")}\n`;
						}

						// Blockchain details
						if (item.outpoint) {
							result += `   Outpoint: ${item.outpoint}\n`;
						}

						if (item.blockHeight !== undefined) {
							const date = item.timestamp
								? new Date(item.timestamp).toLocaleDateString()
								: "Unknown date";
							result += `   Block: ${item.blockHeight}, ${date}\n`;
						}

						result += "\n";
					});
				} else {
					result = `No ${args.queryType} results found.`;
				}

				return {
					content: [{ type: "text", text: result }],
					isError: false,
				};
			} catch (error) {
				console.error("Search error:", error);
				return {
					content: [
						{
							type: "text",
							text: `Error querying A2B Overlay: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);
}
