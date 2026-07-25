import type { OneSatContext } from "@1sat/actions";
import { cancelOrdinalListing } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { assertBroadcastAllowed } from "../../utils/broadcastGuard";

const cancelListingArgsSchema = z.object({
	id: z
		.string()
		.describe(
			"Tracking id of the listing in the ordinals basket (the 'id:' tag from wallet_getOrdinals)",
		),
});

export function registerCancelListingTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		"wallet_cancelListing",
		"Cancel an ordinal marketplace listing",
		{ ...cancelListingArgsSchema.shape },
		async ({ id }) => {
			if (!ctx) {
				return {
					content: [
						{
							type: "text",
							text: "Wallet not initialized. Please configure a wallet before cancelling.",
						},
					],
					isError: true,
				};
			}

			try {
				assertBroadcastAllowed("wallet_cancelListing");
				const result = await cancelOrdinalListing.execute(ctx, { id });

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
