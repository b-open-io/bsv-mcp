import type { OneSatContext } from "@1sat/actions";
import { unlockBsv } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { assertBroadcastAllowed } from "../../utils/broadcastGuard";

export function registerUnlockBsvTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		"wallet_unlockBsv",
		"Unlock all matured time-locked BSV",
		{},
		async () => {
			if (!ctx) {
				return {
					content: [
						{
							type: "text",
							text: "Wallet not initialized. Please configure a wallet before unlocking.",
						},
					],
					isError: true,
				};
			}

			try {
				assertBroadcastAllowed("wallet_unlockBsv");
				const result = await unlockBsv.execute(ctx, {});

				if (result.error) {
					return {
						content: [{ type: "text", text: result.error }],
						isError: true,
					};
				}

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
				return {
					content: [
						{
							type: "text",
							text: err instanceof Error ? err.message : String(err),
						},
					],
					isError: true,
				};
			}
		},
	);
}
