import type { OneSatContext } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { toBitcoin } from 'satoshi-token'

export function registerWalletGetBalanceTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		'wallet_getBalance',
		'Retrieves the current BSV balance for the wallet.',
		{},
		async () => {
			if (!ctx) {
				return {
					content: [
						{
							type: 'text',
							text: 'Wallet not initialized. Please configure a wallet before checking balance.',
						},
					],
					isError: true,
				}
			}

			try {
				const result = await ctx.wallet.listOutputs({ basket: 'default' })
				const totalSatoshis = result.outputs.reduce(
					(sum, output) => sum + output.satoshis,
					0,
				)

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								satoshis: totalSatoshis,
								bsv: toBitcoin(totalSatoshis),
								utxoCount: result.totalOutputs,
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
