import type { OneSatContext } from "@1sat/actions";
import { deregisterOpns } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const opnsDeregisterArgsSchema = z.object({
	id: z
		.string()
		.describe("Tracking id of the OpNS name in the wallet's OPNS basket"),
});

export function registerOpnsDeregisterTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		"wallet_opnsDeregister",
		"Deregister an OpNS name",
		{ ...opnsDeregisterArgsSchema.shape },
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
