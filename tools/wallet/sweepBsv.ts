import type { OneSatContext } from '@1sat/actions'
import { sweepBsv } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const sweepInputSchema = z.object({
	outpoint: z.string().describe('Outpoint (txid_vout)'),
	satoshis: z.number().int().describe('Satoshis in output'),
	lockingScript: z.string().describe('Locking script hex'),
})

const sweepBsvSchema = z.object({
	inputs: z.array(sweepInputSchema).describe('UTXOs to sweep (use prepareSweepInputs to build these)'),
	wif: z.string().describe('WIF private key controlling the inputs'),
	amount: z.number().int().optional().describe('Amount to sweep (satoshis). If omitted, sweeps all input value.'),
})

export function registerSweepBsvTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		'wallet_sweepBsv',
		'Sweep BSV from an external WIF private key into the wallet',
		{ ...sweepBsvSchema.shape },
		async ({ inputs, wif, amount }) => {
			// SECURITY: sanitize WIF from any error output
			const sanitize = (msg: string) =>
				msg.replace(/[5KL][1-9A-HJ-NP-Za-km-z]{50,51}/g, '[REDACTED]')
					.replace(/\b[0-9a-f]{64}\b/gi, '[REDACTED-HEX]');
			if (!ctx) {
				return {
					content: [
						{
							type: 'text' as const,
							text: 'BRC-100 wallet context not available',
						},
					],
					isError: true,
				}
			}

			try {
				const result = await sweepBsv.execute(ctx, { inputs, wif, amount })

				if (result.error) {
					return {
						content: [{ type: 'text' as const, text: result.error }],
						isError: true,
					}
				}

				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text' as const,
							text: sanitize(error instanceof Error ? error.message : String(error)),
						},
					],
					isError: true,
				}
			}
		},
	)
}
