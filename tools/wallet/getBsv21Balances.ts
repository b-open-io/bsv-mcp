import { getBsv21Balances, type OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export function registerGetBsv21BalancesTool(
	server: McpServer,
	ctx?: OneSatContext,
) {
	server.registerTool(
		"wallet_getBsv21Balances",
		{
			description: "Get aggregated BSV21 token balances grouped by token ID",
			inputSchema: z.object({}),
		},
		async () => {
			try {
				if (!ctx) throw new Error("BRC-100 wallet context not available");
				const result = await getBsv21Balances.execute(ctx, {});
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								result,
								(_, v) => (typeof v === "bigint" ? v.toString() : v),
								2,
							),
						},
					],
				};
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);
}
