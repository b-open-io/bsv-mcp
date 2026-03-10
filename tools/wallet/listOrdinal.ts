import type { OneSatContext } from '@1sat/actions'
import { listOrdinal } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const walletOutputSchema = z.object({
	outpoint: z.string(),
	satoshis: z.number().optional(),
	tags: z.array(z.string()).optional(),
	customInstructions: z.string().optional(),
	lockingScript: z.string().optional(),
})

const listOrdinalArgsSchema = z.object({
	ordinal: walletOutputSchema.describe(
		'WalletOutput of the ordinal to list (from wallet_getOrdinals)',
	),
	inputBEEF: z
		.array(z.number())
		.describe(
			"BEEF bytes from listOutputs (include: 'entire transactions')",
		),
	price: z.number().describe('Price in satoshis'),
	payAddress: z
		.string()
		.describe('Address to receive payment on purchase'),
})

export function registerListOrdinalTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		'wallet_listOrdinal',
		'List an ordinal for sale on the marketplace',
		{ ...listOrdinalArgsSchema.shape },
		async ({ ordinal, inputBEEF, price, payAddress }) => {
			if (!ctx) {
				return {
					content: [
						{
							type: 'text',
							text: 'Wallet not initialized. Please configure a wallet before listing.',
						},
					],
					isError: true,
				}
			}

			try {
				const result = await listOrdinal.execute(ctx, {
					ordinal: ordinal as Parameters<typeof listOrdinal.execute>[1]['ordinal'],
					inputBEEF,
					price,
					payAddress,
				})

				if (result.error) {
					return {
						content: [{ type: 'text', text: result.error }],
						isError: true,
					}
				}

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2),
						},
					],
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
