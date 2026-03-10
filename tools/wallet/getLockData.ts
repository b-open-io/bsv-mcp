import { getLockData, type OneSatContext } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerGetLockDataTool(
	server: McpServer,
	ctx?: OneSatContext,
) {
	server.tool(
		'wallet_getLockData',
		'Get summary of time-locked BSV (total, unlockable, next unlock height)',
		{},
		async () => {
			try {
				if (!ctx) throw new Error('BRC-100 wallet context not available')
				const result = await getLockData.execute(ctx, {})
				return {
					content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err)
				return { content: [{ type: 'text', text: msg }], isError: true }
			}
		},
	)
}
