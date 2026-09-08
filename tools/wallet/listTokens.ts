import { listBsv21, type OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export function registerListTokensTool(server: McpServer, ctx?: OneSatContext) {
	server.registerTool(
		"wallet_listTokens",
		{
			description: "List BSV21 token outputs in the wallet",
			inputSchema: z.object({
				limit: z
					.number()
					.int()
					.optional()
					.describe("Max number of results to return"),
			}),
		},
		async (params) => {
			try {
				if (!ctx) throw new Error("BRC-100 wallet context not available");
				const result = await listBsv21.execute(ctx, params);
				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				};
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);
}
