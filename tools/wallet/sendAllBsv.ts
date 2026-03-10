import type { OneSatContext } from '@1sat/actions'
import { sendAllBsv } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const sendAllBsvArgsSchema = z.object({
	destination: z
		.string()
		.describe('Destination P2PKH address to send all funds to'),
})

export function registerSendAllBsvTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		'wallet_sendAllBsv',
		'Send all BSV in the wallet to a single recipient',
		{ ...sendAllBsvArgsSchema.shape },
		async ({ destination }) => {
			if (!ctx) {
				return {
					content: [
						{
							type: 'text',
							text: 'Wallet not initialized. Please configure a wallet before sending.',
						},
					],
					isError: true,
				}
			}

			try {
				const result = await sendAllBsv.execute(ctx, { destination })

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
