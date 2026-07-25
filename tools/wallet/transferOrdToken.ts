import type { OneSatContext } from "@1sat/actions";
import { sendBsv21, sendOrdinals } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const transferOrdTokenArgsSchema = z.object({
	type: z
		.enum(["ordinal", "bsv21"])
		.describe(
			"'ordinal' to transfer an inscription/NFT, 'bsv21' to send fungible BSV21 tokens",
		),
	// ordinal fields
	id: z
		.string()
		.optional()
		.describe(
			"Tracking id of the ordinal in the ordinals basket (the 'id:' tag from wallet_getOrdinals). Required when type='ordinal'",
		),
	// bsv21 fields
	tokenId: z
		.string()
		.optional()
		.describe("Token ID (txid_vout format). Required when type='bsv21'"),
	amount: z
		.string()
		.optional()
		.describe(
			"Amount of tokens to send as a string integer. Required when type='bsv21'",
		),
	// shared destination fields
	address: z.string().optional().describe("Recipient P2PKH address"),
	counterparty: z
		.string()
		.optional()
		.describe("Recipient identity public key (hex)"),
});

export type TransferOrdTokenArgs = z.infer<typeof transferOrdTokenArgsSchema>;

export function registerTransferOrdTokenTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		"wallet_transferOrdToken",
		"Transfer an ordinal inscription or send BSV21 fungible tokens. Use type='ordinal' to transfer an NFT/inscription by its ordinals-basket tracking id (from wallet_getOrdinals). Use type='bsv21' to send fungible tokens by token ID and amount.",
		{ ...transferOrdTokenArgsSchema.shape },
		async ({ type, id, tokenId, amount, address, counterparty }) => {
			if (!ctx) {
				return {
					content: [
						{
							type: "text",
							text: "Wallet not initialized. Please configure a wallet before transferring.",
						},
					],
					isError: true,
				};
			}

			try {
				if (!address && !counterparty) {
					return {
						content: [
							{ type: "text", text: "address or counterparty is required" },
						],
						isError: true,
					};
				}

				if (type === "ordinal") {
					if (!id) {
						return {
							content: [
								{
									type: "text",
									text: "id is required when type='ordinal'",
								},
							],
							isError: true,
						};
					}

					const result = await sendOrdinals.execute(ctx, {
						transfers: [{ id, address, counterparty }],
					});

					if (result.error) {
						return {
							content: [{ type: "text", text: result.error }],
							isError: true,
						};
					}

					return {
						content: [
							{ type: "text", text: JSON.stringify({ txid: result.txid }) },
						],
					};
				}

				// bsv21
				if (!tokenId) {
					return {
						content: [
							{ type: "text", text: "tokenId is required when type='bsv21'" },
						],
						isError: true,
					};
				}
				if (!amount) {
					return {
						content: [
							{ type: "text", text: "amount is required when type='bsv21'" },
						],
						isError: true,
					};
				}

				const result = await sendBsv21.execute(ctx, {
					tokenId,
					recipients: [{ amount, destination: { address, counterparty } }],
				});

				if (result.error) {
					return {
						content: [{ type: "text", text: result.error }],
						isError: true,
					};
				}

				return {
					content: [
						{ type: "text", text: JSON.stringify({ txid: result.txid }) },
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
