import { getLockData, type OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export function registerGetLockDataTool(
	server: McpServer,
	ctx?: OneSatContext,
) {
	server.registerTool(
		"wallet_getLockData",
		{
			description:
				"Get summary of time-locked BSV (total, unlockable, next unlock height)",
			inputSchema: z.object({}),
		},
		async () => {
			try {
				if (!ctx) throw new Error("BRC-100 wallet context not available");
				const result = await getLockData.execute(ctx, {});
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
