import type { OneSatContext } from '@1sat/actions'
import { cancelListing } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const walletOutputSchema = z.object({
	outpoint: z.string(),
	satoshis: z.number().optional(),
	tags: z.array(z.string()).optional(),
	customInstructions: z.string().optional(),
	lockingScript: z.string().optional(),
})

const cancelListingArgsSchema = z.object({
	listing: walletOutputSchema.describe(
		'WalletOutput of the listing to cancel (must include lockingScript)',
	),
	inputBEEF: z
		.array(z.number())
		.describe(
			"BEEF bytes from listOutputs (include: 'entire transactions')",
		),
})

export function registerCancelListingTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		'wallet_cancelListing',
		'Cancel an ordinal marketplace listing',
		{ ...cancelListingArgsSchema.shape },
		async ({ listing, inputBEEF }) => {
			if (!ctx) {
				return {
					content: [
						{
							type: 'text',
							text: 'Wallet not initialized. Please configure a wallet before cancelling.',
						},
					],
					isError: true,
				}
			}

			try {
				const result = await cancelListing.execute(ctx, {
					listing: listing as Parameters<typeof cancelListing.execute>[1]['listing'],
					inputBEEF,
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
