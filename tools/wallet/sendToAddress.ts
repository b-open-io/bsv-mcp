import type { OneSatContext } from '@1sat/actions'
import { sendBsv } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { toSatoshi } from 'satoshi-token'
import { getBsvPriceWithCache } from '../bsv/getPrice'
import { sendToAddressArgsSchema } from './schemas'

export function registerSendToAddressTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		'wallet_sendToAddress',
		'Sends Bitcoin SV (BSV) to a specified address. This tool supports payments in both BSV and USD amounts (with automatic conversion using current exchange rates). Transaction fees are automatically calculated and a confirmation with transaction ID is returned upon success.',
		{ ...sendToAddressArgsSchema.shape },
		async ({ address, amount, currency = 'BSV', description = 'Send to address' }) => {
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
				let satoshis: number
				if (currency === 'USD') {
					const bsvPriceUsd = await getBsvPriceWithCache()
					satoshis = toSatoshi(amount / bsvPriceUsd)
				} else {
					satoshis = toSatoshi(amount)
				}

				const result = await sendBsv.execute(ctx, {
					requests: [{ address, satoshis }],
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
							text: JSON.stringify({
								status: 'success',
								txid: result.txid,
								satoshis,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: error instanceof Error ? error.message : String(error),
						},
					],
					isError: true,
				}
			}
		},
	)
}
