import type { OneSatContext } from '@1sat/actions'
import { sendBsv } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { toSatoshi } from 'satoshi-token'
import { z } from 'zod'
import { getBsvPriceWithCache } from '../bsv/getPrice'

const recipientSchema = z.object({
	address: z.string().optional().describe('Destination P2PKH address'),
	paymail: z.string().optional().describe('Destination paymail address'),
	amount: z.number().describe('Amount to send'),
	currency: z.enum(['BSV', 'USD']).optional().default('BSV').describe('Currency of amount (default: BSV)'),
})

const sendBsvArgsSchema = z.object({
	recipients: z.array(recipientSchema).describe('Array of payment recipients'),
})

export function registerSendBsvTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		'wallet_sendBsv',
		'Send BSV to one or more recipients by address or paymail. Supports BSV and USD amounts with automatic conversion.',
		{ ...sendBsvArgsSchema.shape },
		async ({ recipients }) => {
			if (!ctx) {
				return {
					content: [{ type: 'text', text: 'Wallet not initialized.' }],
					isError: true,
				}
			}

			try {
				let bsvPrice: number | undefined

				const requests = await Promise.all(
					recipients.map(async (r) => {
						if (!r.address && !r.paymail) {
							throw new Error('Each recipient requires an address or paymail')
						}

						let satoshis: number
						if (r.currency === 'USD') {
							if (!bsvPrice) bsvPrice = await getBsvPriceWithCache()
							satoshis = toSatoshi(r.amount / bsvPrice)
						} else {
							satoshis = toSatoshi(r.amount)
						}

						return {
							...(r.address && { address: r.address }),
							...(r.paymail && { paymail: r.paymail }),
							satoshis,
						}
					}),
				)

				const result = await sendBsv.execute(ctx, { requests })

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
							text: JSON.stringify({
								status: 'success',
								txid: result.txid,
								recipients: requests.map((r) => ({
									destination: r.address || r.paymail,
									satoshis: r.satoshis,
								})),
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{ type: 'text', text: error instanceof Error ? error.message : String(error) },
					],
					isError: true,
				}
			}
		},
	)
}
