import { getBsv21Balances, type OneSatContext } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerGetBsv21BalancesTool(
	server: McpServer,
	ctx?: OneSatContext,
) {
	server.tool(
		'wallet_getBsv21Balances',
		'Get aggregated BSV21 token balances grouped by token ID',
		{},
		async () => {
			try {
				if (!ctx) throw new Error('BRC-100 wallet context not available')
				const result = await getBsv21Balances.execute(ctx, {})
				return {
					content: [{
						type: 'text',
						text: JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2),
					}],
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err)
				return { content: [{ type: 'text', text: msg }], isError: true }
			}
		},
	)
}
