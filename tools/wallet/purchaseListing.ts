import { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
	type ChangeResult,
	type ExistingListing,
	type LocalSigner,
	type Payment,
	type PurchaseOrdListingConfig,
	type Royalty,
	TokenType,
	type TokenUtxo,
	type Utxo,
	oneSatBroadcaster,
	purchaseOrdListing,
	purchaseOrdTokenListing,
} from "js-1sat-ord";
import { Sigma } from "sigma-protocol";
import type { z } from "zod";
import {
	MARKET_FEE_PERCENTAGE,
	MARKET_WALLET_ADDRESS,
	MINIMUM_MARKET_FEE_SATOSHIS,
} from "../constants";
import { purchaseListingArgsSchema } from "./schemas";
import type { Wallet } from "./wallet";

// Define types for 1Sat API response
interface OrdUtxo {
	txid: string;
	vout: number;
	satoshis: number;
	script: string;
	origin?: {
		outpoint: string;
		data?: {
			map?: {
				royalties?: string;
				[key: string]: string | number | boolean | null | undefined;
			};
			insc?: {
				text?: string;
				file?: {
					type?: string;
					size?: number;
				};
			};
		};
	};
	data?: {
		list?: {
			price: number;
			payout: string;
		};
		bsv20?: {
			amt?: string;
			tick?: string;
			id?: string;
		};
	};
}

/**
 * Register the purchaseListing tool
 *
 * This tool enables purchasing listed ordinals (NFTs or tokens) from the marketplace:
 * 1. Parses the listing outpoint to get the txid and vout
 * 2. Fetches the listing UTXO from the ordinals API
 * 3. Gets the wallet's payment UTXOs (using the wallet's internal UTXO management)
 * 4. Uses purchaseOrdListing or purchaseOrdTokenListing based on the listing type
 * 5. For NFTs, automatically detects and processes royalty payments to original creators
 * 6. Broadcasts the transaction
 * 7. Returns the transaction details including success status and txid
 *
 * The tool supports both NFT and token listings with appropriate type-specific handling.
 * Royalty payments are supported for NFT purchases only (based on creator-defined metadata).
 */
export function registerPurchaseListingTool(server: McpServer, wallet: Wallet) {
	// Store a reference to check if wallet is persistent

	server.tool(
		"wallet_purchaseListing",
		"Purchases a listing from the Bitcoin SV ordinals marketplace. Supports both NFT purchases (with royalty payments to original creators) and BSV-20/BSV-21 token purchases. The tool handles all aspects of the transaction - from fetching listing details, calculating fees, creating and broadcasting the transaction.",
		{ args: purchaseListingArgsSchema },
		async (
			{ args }: { args: z.infer<typeof purchaseListingArgsSchema> },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		): Promise<CallToolResult> => {
			try {
				// Load optional identity key for sigma signing
				const identityKeyWif = process.env.IDENTITY_KEY_WIF;
				let identityPk: PrivateKey | undefined;
				if (identityKeyWif) {
					try {
						identityPk = PrivateKey.fromWif(identityKeyWif);
					} catch (e) {
						console.warn(
							"Warning: Invalid IDENTITY_KEY_WIF environment variable; sigma signing disabled",
							e,
						);
					}
				}

				// Fetch the listing info directly from the API
				const response = await fetch(
					`https://ordinals.gorillapool.io/api/txos/${args.listingOutpoint}?script=true`,
				);
				if (!response.ok) {
					throw new Error(
						`Failed to fetch listing data: ${response.statusText}`,
					);
				}

				const listingData = (await response.json()) as OrdUtxo;

				// Check if the listing is valid and has a price
				if (!listingData.data?.list?.price) {
					throw new Error("Listing is either not for sale or invalid");
				}

				// Check if payout is available
				if (!listingData.data.list.payout) {
					throw new Error("Listing doesn't have payout information");
				}

				// Calculate the market fee (3% of listing price)
				const listingPrice = listingData.data.list.price;
				let marketFee = Math.round(listingPrice * MARKET_FEE_PERCENTAGE);

				// Ensure minimum fee
				if (marketFee < MINIMUM_MARKET_FEE_SATOSHIS) {
					marketFee = MINIMUM_MARKET_FEE_SATOSHIS;
				}

				// Parse the listing outpoint to get txid and vout
				const [txid, voutStr] = args.listingOutpoint.split("_");
				if (!txid) {
					throw new Error("Invalid outpoint format. Expected txid_vout");
				}
				const vout = Number.parseInt(voutStr || "0", 10);

				// Get private key from the wallet
				const paymentPk = wallet.getPrivateKey();
				if (!paymentPk) {
					throw new Error("No private key available in wallet");
				}

				// Get payment address
				const paymentAddress = paymentPk.toAddress().toString();

				// Get payment UTXOs from the wallet's managed UTXOs
				const { paymentUtxos } = await wallet.getUtxos();
				if (!paymentUtxos || paymentUtxos.length === 0) {
					// Provide more helpful error message with instructions
					throw new Error(
						`No payment UTXOs available for address ${paymentAddress}. 
Please fund this wallet address with enough BSV to cover the purchase price 
(${listingData.data.list.price} satoshis) plus market fee (${marketFee} satoshis) and transaction fees.`,
					);
				}

				// Define market fee payment
				const additionalPayments: Payment[] = [
					{
						to: MARKET_WALLET_ADDRESS,
						amount: marketFee,
					},
				];

				// Define metadata for the transaction
				const metaData = {
					app: "bsv-mcp",
					type: "ord",
					op: "purchase",
				};

				// Create the purchase transaction based on listing type
				let transaction: ChangeResult;

				if (args.listingType === "token") {
					if (!args.tokenProtocol) {
						throw new Error("tokenProtocol is required for token listings");
					}

					if (!args.tokenID) {
						throw new Error("tokenID is required for token listings");
					}

					// Validate token data from the listing
					if (!listingData.data.bsv20) {
						throw new Error("This is not a valid BSV-20 token listing");
					}

					// For BSV-20, the amount should be included in the listing data
					if (!listingData.data.bsv20.amt) {
						throw new Error("Token listing doesn't have an amount specified");
					}

					// Convert the token protocol to the enum type expected by js-1sat-ord
					const protocol =
						args.tokenProtocol === "bsv-20" ? TokenType.BSV20 : TokenType.BSV21;

					// Create a TokenUtxo with the required fields
					const listingUtxo: TokenUtxo = {
						txid,
						vout,
						script: listingData.script,
						satoshis: 1, // TokenUtxo's satoshis must be exactly 1
						amt: listingData.data.bsv20.amt,
						id: args.tokenID,
						payout: listingData.data.list.payout,
					};

					transaction = await purchaseOrdTokenListing({
						protocol,
						tokenID: args.tokenID,
						utxos: paymentUtxos,
						paymentPk,
						listingUtxo,
						ordAddress: args.ordAddress,
						additionalPayments,
						metaData,
					});
				} else {
					// Create a regular Utxo for NFT listing
					const listingUtxo: Utxo = {
						txid,
						vout,
						script: listingData.script,
						satoshis: listingData.satoshis,
					};

					// Create the ExistingListing object for NFT listings
					const listing: ExistingListing = {
						payout: listingData.data.list.payout,
						listingUtxo,
					};

					// Check for royalties in the NFT origin data
					// Royalties are only supported for NFTs, not for tokens
					// The royalties are defined by the original creator as a JSON string
					// in the NFT's metadata and parsed into a Royalty[] array
					let royalties: Royalty[] = [];
					if (listingData.origin?.data?.map?.royalties) {
						try {
							royalties = JSON.parse(listingData.origin.data.map.royalties);
						} catch (error) {
							// Remove console.warn
						}
					}

					const purchaseOrdListingConfig: PurchaseOrdListingConfig = {
						utxos: paymentUtxos,
						paymentPk,
						ordAddress: args.ordAddress,
						listing,
						additionalPayments,
						metaData,
						royalties,
					};

					transaction = await purchaseOrdListing(purchaseOrdListingConfig);
				}

				// After successful transaction creation, refresh the wallet's UTXOs
				// This ensures the wallet doesn't try to reuse spent UTXOs
				try {
					await wallet.refreshUtxos();
				} catch (refreshError) {
					// Remove console.warn
				}

				// Optionally sign with identity key then broadcast the transaction

				const disableBroadcasting = process.env.DISABLE_BROADCASTING === "true";
				if (!disableBroadcasting) {
					const broadcastResult = await transaction.tx.broadcast(
						oneSatBroadcaster(),
					);
					// Handle broadcast response
					const resultStatus =
						typeof broadcastResult === "object" && "status" in broadcastResult
							? broadcastResult.status
							: "unknown";

					const resultMessage =
						typeof broadcastResult === "object" && "error" in broadcastResult
							? broadcastResult.error
							: "Transaction broadcast successful";

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									status: resultStatus,
									message: resultMessage,
									txid: transaction.tx.id("hex"),
									listingOutpoint: args.listingOutpoint,
									destinationAddress: args.ordAddress,
									listingType: args.listingType,
									tokenProtocol: args.tokenID ? args.tokenProtocol : undefined,
									tokenID: args.tokenID,
									price: listingData.data.list.price,
									marketFee,
									marketFeeAddress: MARKET_WALLET_ADDRESS,
									royaltiesPaid:
										args.listingType === "nft" &&
										listingData.origin?.data?.map?.royalties
											? JSON.parse(listingData.origin.data.map.royalties)
											: undefined,
								}),
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text",
							text: transaction.tx.toHex(),
						},
					],
				};
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);
}
