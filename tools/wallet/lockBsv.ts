import type { OneSatContext } from '@1sat/actions'
import { lockBsv } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const lockBsvArgsSchema = z.object({
	requests: z
		.array(
			z.object({
				satoshis: z.number().describe('Amount in satoshis to lock'),
				until: z.number().describe('Block height until which to lock'),
			}),
		)
		.describe('Array of lock requests'),
})

export function registerLockBsvTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		'wallet_lockBsv',
		'Lock BSV until a specific block height',
		{ ...lockBsvArgsSchema.shape },
		async ({ requests }) => {
			if (!ctx) {
				return {
					content: [
						{
							type: 'text',
							text: 'Wallet not initialized. Please configure a wallet before locking.',
						},
					],
					isError: true,
				}
			}

			try {
				const result = await lockBsv.execute(ctx, { requests })

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
