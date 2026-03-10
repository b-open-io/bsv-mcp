import type { OneSatContext } from '@1sat/actions'
import { purchaseBsv21, purchaseOrdinal } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
	MARKET_FEE_PERCENTAGE,
	MARKET_WALLET_ADDRESS,
	MINIMUM_MARKET_FEE_SATOSHIS,
} from '../constants'
import { purchaseListingArgsSchema } from './schemas'

export function registerPurchaseListingTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		'wallet_purchaseListing',
		'Purchases a listing from the Bitcoin SV ordinals marketplace. Supports both NFT purchases and BSV21 token purchases.',
		{ ...purchaseListingArgsSchema.shape },
		async ({ listingOutpoint, listingType, tokenID, tokenAmount, description }): Promise<CallToolResult> => {
			if (!ctx) {
				return {
					content: [
						{
							type: 'text',
							text: 'Wallet not initialized. Please configure a wallet before purchasing.',
						},
					],
					isError: true,
				}
			}

			try {
				let marketplaceRate = MARKET_FEE_PERCENTAGE

				if (listingType === 'token') {
					if (!tokenID) {
						throw new Error('tokenID is required for token listings')
					}

					if (!tokenAmount) {
						const response = await fetch(
							`https://ordinals.gorillapool.io/api/txos/${listingOutpoint}?script=true`,
						)
						if (!response.ok) {
							throw new Error(`Failed to fetch listing data: ${response.statusText}`)
						}
						const listingData = (await response.json()) as {
							data?: { list?: { price: number }; bsv20?: { amt?: string } }
						}
						if (!listingData.data?.bsv20?.amt) {
							throw new Error('Token listing does not have an amount')
						}
						tokenAmount = listingData.data.bsv20.amt

						if (listingData.data?.list?.price) {
							const fee = Math.round(listingData.data.list.price * MARKET_FEE_PERCENTAGE)
							marketplaceRate = Math.max(fee, MINIMUM_MARKET_FEE_SATOSHIS) / listingData.data.list.price
						}
					}

					const result = await purchaseBsv21.execute(ctx, {
						tokenId: tokenID,
						outpoint: listingOutpoint,
						amount: tokenAmount,
						marketplaceAddress: MARKET_WALLET_ADDRESS,
						marketplaceRate,
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
									listingOutpoint,
									listingType,
									tokenID,
								}),
							},
						],
					}
				}

				const result = await purchaseOrdinal.execute(ctx, {
					outpoint: listingOutpoint,
					marketplaceAddress: MARKET_WALLET_ADDRESS,
					marketplaceRate,
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
								listingOutpoint,
								listingType,
							}),
						},
					],
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err)
				return { content: [{ type: 'text', text: msg }], isError: true }
			}
		},
	)
}
