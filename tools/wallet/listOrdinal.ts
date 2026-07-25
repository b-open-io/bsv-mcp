import type { OneSatContext } from "@1sat/actions";
import { sellOrdinal } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { assertBroadcastAllowed } from "../../utils/broadcastGuard";

const listOrdinalArgsSchema = z.object({
	id: z
		.string()
		.describe(
			"Tracking id of the ordinal in the ordinals basket (the 'id:' tag from wallet_getOrdinals)",
		),
	price: z
		.number()
		.int()
		.positive()
		.describe("Price in satoshis; whole satoshis above zero"),
	payAddress: z
		.string()
		.optional()
		.describe(
			"Address to receive payment on purchase. Defaults to the wallet's P1SAT '1sat 0' address.",
		),
});

export function registerListOrdinalTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		"wallet_listOrdinal",
		"List an ordinal for sale on the marketplace",
		{ ...listOrdinalArgsSchema.shape },
		async ({ id, price, payAddress }) => {
			if (!ctx) {
				return {
					content: [
						{
							type: "text",
							text: "Wallet not initialized. Please configure a wallet before listing.",
						},
					],
					isError: true,
				};
			}

			try {
				assertBroadcastAllowed("wallet_listOrdinal");
				const result = await sellOrdinal.execute(ctx, {
					id,
					price,
					payAddress,
				});

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
