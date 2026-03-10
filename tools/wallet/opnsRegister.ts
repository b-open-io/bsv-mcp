import type { OneSatContext } from '@1sat/actions'
import { opnsRegister } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const walletOutputSchema = z.object({
	outpoint: z.string(),
	satoshis: z.number().optional(),
	tags: z.array(z.string()).optional(),
	customInstructions: z.string().optional(),
	lockingScript: z.string().optional(),
})

const opnsRegisterArgsSchema = z.object({
	ordinal: walletOutputSchema.describe(
		'WalletOutput of the OpNS ordinal to register (from listOutputs)',
	),
	inputBEEF: z
		.array(z.number())
		.describe(
			"BEEF bytes from listOutputs (include: 'entire transactions')",
		),
})

export function registerOpnsRegisterTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		'wallet_opnsRegister',
		'Register an OpNS name',
		{ ...opnsRegisterArgsSchema.shape },
		async ({ ordinal, inputBEEF }) => {
			if (!ctx) {
				return {
					content: [
						{
							type: 'text',
							text: 'Wallet not initialized. Please configure a wallet before registering.',
						},
					],
					isError: true,
				}
			}

			try {
				const result = await opnsRegister.execute(ctx, {
					ordinal: ordinal as Parameters<typeof opnsRegister.execute>[1]['ordinal'],
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
