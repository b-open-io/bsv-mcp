import type { OneSatContext } from "@1sat/actions";
import { deregisterOpns } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { assertBroadcastAllowed } from "../../utils/broadcastGuard";

const opnsDeregisterArgsSchema = z.object({
	id: z
		.string()
		.describe("Tracking id of the OpNS name in the wallet's OPNS basket"),
});

export function registerOpnsDeregisterTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.registerTool(
		"wallet_opnsDeregister",
		{
			description: "Deregister an OpNS name",
			inputSchema: opnsDeregisterArgsSchema,
		},
		async ({ id }) => {
			if (!ctx) {
				return {
					content: [
						{
							type: "text",
							text: "Wallet not initialized. Please configure a wallet before deregistering.",
						},
					],
					isError: true,
				};
			}

			try {
				assertBroadcastAllowed("wallet_opnsDeregister");
				const result = await deregisterOpns.execute(ctx, { id });

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
