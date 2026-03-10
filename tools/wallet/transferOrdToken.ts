import type { OneSatContext } from '@1sat/actions'
import { sendBsv21, transferOrdinals } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const walletOutputSchema = z.object({
	outpoint: z.string(),
	satoshis: z.number().optional(),
	tags: z.array(z.string()).optional(),
	customInstructions: z.string().optional(),
	lockingScript: z.string().optional(),
})

export const transferOrdTokenArgsSchema = z.object({
	type: z.enum(['ordinal', 'bsv21']).describe(
		"'ordinal' to transfer an inscription/NFT, 'bsv21' to send fungible BSV21 tokens",
	),
	// ordinal fields
	ordinal: walletOutputSchema
		.optional()
		.describe(
			"WalletOutput of the ordinal to transfer (from wallet_getOrdinals). Required when type='ordinal'",
		),
	inputBEEF: z
		.array(z.number())
		.optional()
		.describe(
			"BEEF bytes from listOutputs (include: 'entire transactions'). Required when type='ordinal'",
		),
	// bsv21 fields
	tokenId: z
		.string()
		.optional()
		.describe("Token ID (txid_vout format). Required when type='bsv21'"),
	amount: z
		.string()
		.optional()
		.describe("Amount of tokens to send as a string integer. Required when type='bsv21'"),
	// shared destination fields
	address: z.string().optional().describe('Recipient P2PKH address'),
	counterparty: z
		.string()
		.optional()
		.describe('Recipient identity public key (hex)'),
})

export type TransferOrdTokenArgs = z.infer<typeof transferOrdTokenArgsSchema>

export function registerTransferOrdTokenTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		'wallet_transferOrdToken',
		"Transfer an ordinal inscription or send BSV21 fungible tokens. Use type='ordinal' to transfer an NFT/inscription (requires the WalletOutput from wallet_getOrdinals and the BEEF). Use type='bsv21' to send fungible tokens by token ID and amount.",
		{ ...transferOrdTokenArgsSchema.shape },
		async ({ type, ordinal, inputBEEF, tokenId, amount, address, counterparty }) => {
			if (!ctx) {
				return {
					content: [
						{
							type: 'text',
							text: 'Wallet not initialized. Please configure a wallet before transferring.',
						},
					],
					isError: true,
				}
			}

			try {
				if (type === 'ordinal') {
					if (!ordinal) {
						return {
							content: [{ type: 'text', text: "ordinal is required when type='ordinal'" }],
							isError: true,
						}
					}
					if (!inputBEEF) {
						return {
							content: [{ type: 'text', text: "inputBEEF is required when type='ordinal'" }],
							isError: true,
						}
					}
					if (!address && !counterparty) {
						return {
							content: [{ type: 'text', text: 'address or counterparty is required' }],
							isError: true,
						}
					}

					const result = await transferOrdinals.execute(ctx, {
						transfers: [
							{
								ordinal: ordinal as Parameters<typeof transferOrdinals.execute>[1]['transfers'][0]['ordinal'],
								address,
								counterparty,
							},
						],
						inputBEEF,
					})

					if (result.error) {
						return {
							content: [{ type: 'text', text: result.error }],
							isError: true,
						}
					}

					return {
						content: [{ type: 'text', text: JSON.stringify({ txid: result.txid }) }],
					}
				}

				// bsv21
				if (!tokenId) {
					return {
						content: [{ type: 'text', text: "tokenId is required when type='bsv21'" }],
						isError: true,
					}
				}
				if (!amount) {
					return {
						content: [{ type: 'text', text: "amount is required when type='bsv21'" }],
						isError: true,
					}
				}
				if (!address && !counterparty) {
					return {
						content: [{ type: 'text', text: 'address or counterparty is required' }],
						isError: true,
					}
				}

				const result = await sendBsv21.execute(ctx, {
					tokenId,
					amount,
					address,
					counterparty,
				})

				if (result.error) {
					return {
						content: [{ type: 'text', text: result.error }],
						isError: true,
					}
				}

				return {
					content: [{ type: 'text', text: JSON.stringify({ txid: result.txid }) }],
				}
			} catch (err: unknown) {
				return {
					content: [
						{
							type: 'text',
							text: err instanceof Error ? err.message : String(err),
						},
					],
					isError: true,
				}
			}
		},
	)
}
