import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type OverlayRequest = {
	type: "agent" | "tool";
	query: string;
	limit: number;
	offset: number;
	fromBlock?: number;
	toBlock?: number;
};

type OverlayResponse = {
	agents: {
		name: string;
		description: string;
		capabilities: string[];
	}[];
	tools: {
		name: string;
		description: string;
	}[];
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
			if (args.queryType === "agent") {
				return {
					content: [
						{ type: "text", text: "Agent discovery is not supported yet" },
					],
					isError: true,
				};
			}

			if (args.queryType !== "tool") {
				return {
					content: [
						{
							type: "text",
							text: "Only tool discovery is supported currently",
						},
					],
					isError: true,
				};
			}

			try {
				const params = new URLSearchParams();
				params.set("type", args.queryType);
				params.set("query", args.query);
				params.set("limit", args.limit?.toString() ?? "5");
				params.set("offset", args.offset?.toString() ?? "0");
				if (args.fromBlock) {
					params.set("fromBlock", args.fromBlock.toString());
				}
				if (args.toBlock) {
					params.set("toBlock", args.toBlock.toString());
				}
				const OVERLAY_URL = `https://overlay.a2b.network/v1/search?${params.toString()}`;
				const response = await fetch(OVERLAY_URL);
				const data = (await response.json()) as OverlayResponse;
				return {
					content: [{ type: "text", text: JSON.stringify(data) }],
					isError: false,
				};
			} catch (error) {
				return {
					content: [{ type: "text", text: `Error querying overlay: ${error}` }],
					isError: true,
				};
			}
		},
	);
}
