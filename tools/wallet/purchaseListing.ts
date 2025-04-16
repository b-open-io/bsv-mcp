// import { PrivateKey } from "@bsv/sdk"; // not used here
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
	type ChangeResult,
	type ExistingListing,
	type Payment,
	type TokenUtxo,
	type Utxo,
	TokenType,
	oneSatBroadcaster,
	purchaseOrdListing,
	purchaseOrdTokenListing,
} from "js-1sat-ord";
import type { z } from "zod";
import {
	MARKET_FEE_PERCENTAGE,
	MARKET_WALLET_ADDRESS,
	MINIMUM_MARKET_FEE_SATOSHIS,
} from "../constants";
import { purchaseListingArgsSchema } from "./schemas";
import type { Wallet } from "./wallet";

// Define types for 1Sat API response
interface ListingResponse {
	txid: string;
	vout: number;
	satoshis: number;
	script: string;
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
 * This tool:
 * 1. Parses the listing outpoint to get the txid and vout
 * 2. Fetches the listing UTXO from the ordinals API
 * 3. Gets the wallet's payment UTXOs (using the wallet's internal UTXO management)
 * 4. Uses purchaseOrdListing or purchaseOrdTokenListing based on the listing type
 * 5. Broadcasts the transaction
 * 6. Returns the transaction details
 */
export function registerPurchaseListingTool(server: McpServer, wallet: Wallet) {
	// Store a reference to check if wallet is persistent
	console.log("Registering purchaseListing tool with wallet:", wallet);

	server.tool(
		"wallet_purchaseListing",
		{ args: purchaseListingArgsSchema },
		async (
			{ args }: { args: z.infer<typeof purchaseListingArgsSchema> },
			extra: RequestHandlerExtra,
		): Promise<CallToolResult> => {
			try {
				console.log(`Attempting to purchase listing: ${args.listingOutpoint}`);
				console.log(`Listing type: ${args.listingType}`);
				console.log("Using wallet instance:", wallet);
				console.log("Wallet has UTXOs:", await wallet.getUtxos());

				// Fetch the listing info directly from the API
				const response = await fetch(
					`https://ordinals.gorillapool.io/api/txos/${args.listingOutpoint}?script=true`,
				);
				if (!response.ok) {
					throw new Error(
						`Failed to fetch listing data: ${response.statusText}`,
					);
				}

				const listingData = (await response.json()) as ListingResponse;

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

				console.log(`Listing price: ${listingPrice} satoshis`);
				console.log(
					`Market fee: ${marketFee} satoshis (${MARKET_FEE_PERCENTAGE * 100}%)`,
				);

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
				console.log(`Using payment address: ${paymentAddress}`);

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
					const protocol = args.tokenProtocol === "bsv-20" 
						? TokenType.BSV20
						: TokenType.BSV21;
					
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
					
					transaction = await purchaseOrdListing({
						utxos: paymentUtxos,
						paymentPk,
						ordAddress: args.ordAddress,
						listing,
						additionalPayments,
						metaData,
					});
				}

				// After successful transaction creation, refresh the wallet's UTXOs
				// This ensures the wallet doesn't try to reuse spent UTXOs
				try {
					await wallet.refreshUtxos();
				} catch (refreshError) {
					console.warn(
						"Failed to refresh UTXOs after transaction:",
						refreshError,
					);
				}

				// Broadcast the transaction
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
							}),
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
