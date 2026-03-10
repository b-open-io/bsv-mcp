import type { OneSatContext } from '@1sat/actions'
import { inscribe } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

export const createOrdinalsArgsSchema = z.object({
	dataB64: z.string().describe('Base64-encoded content to inscribe'),
	contentType: z.string().describe('MIME type of the content'),
	destinationAddress: z
		.string()
		.optional()
		.describe('Optional destination address for the ordinal'),
	metadata: z
		.record(z.string(), z.string())
		.optional()
		.describe('Optional MAP metadata for the inscription'),
	signWithBAP: z
		.boolean()
		.optional()
		.describe('Sign with BAP identity (Sigma protocol). Uses anchor+inscription two-step flow.'),
})

export type CreateOrdinalsArgs = z.infer<typeof createOrdinalsArgsSchema>

export function registerCreateOrdinalsTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		'wallet_createOrdinals',
		'Creates and inscribes ordinals (NFTs) on the Bitcoin SV blockchain. This tool lets you mint new digital artifacts by encoding data directly into the blockchain. Supports various content types including images, text, JSON, and HTML. The tool handles transaction creation, fee calculation, and broadcasting.',
		{ ...createOrdinalsArgsSchema.shape },
		async ({ dataB64, contentType, destinationAddress, metadata, signWithBAP }): Promise<CallToolResult> => {
			if (!ctx) {
				return {
					content: [
						{
							type: 'text',
							text: 'Wallet not initialized. Please configure a wallet before creating ordinals.',
						},
					],
					isError: true,
				}
			}

			try {
				const result = await inscribe.execute(ctx, {
					base64Content: dataB64,
					contentType,
					map: metadata,
					signWithBAP,
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
								txid: result.txid,
								rawtx: result.rawtx,
								contentType,
							}),
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
