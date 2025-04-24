import { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { sendOrdinals } from "js-1sat-ord";
import type {
	ChangeResult,
	LocalSigner,
	SendOrdinalsConfig,
} from "js-1sat-ord";
import { Sigma } from "sigma-protocol";
import { z } from "zod";
import type { Wallet } from "./wallet";

/**
 * Schema for the sendOrdinals tool arguments
 */
export const sendOrdinalsArgsSchema = z.object({
	// Outpoint of the inscription to send (txid_vout format)
	inscriptionOutpoint: z
		.string()
		.describe("Inscription outpoint in format txid_vout"),
	// Destination address to send the inscription to
	destinationAddress: z
		.string()
		.describe("Destination address for the inscription"),
	// Optional metadata for the ordinal transfer
	metadata: z
		.any()
		.optional()
		.describe("Optional MAP metadata for the transfer"),
});

export type SendOrdinalsArgs = z.infer<typeof sendOrdinalsArgsSchema>;

/**
 * Registers the wallet_sendOrdinals tool for transferring ordinals
 */
export function registerSendOrdinalsTool(server: McpServer, wallet: Wallet) {
	server.tool(
		"wallet_sendOrdinals",
		"Transfers ordinals (NFTs) from your wallet to another address on the Bitcoin SV blockchain. This tool enables sending inscriptions you own to any valid BSV address. The transaction is created, signed, and broadcast automatically, with appropriate fee calculation and change handling.",
		{ args: sendOrdinalsArgsSchema },
		async (
			{ args }: { args: SendOrdinalsArgs },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		): Promise<CallToolResult> => {
			try {
				// 1. Get private key from wallet
				const paymentPk = wallet.getPrivateKey();
				if (!paymentPk) {
					throw new Error("No private key available in wallet");
				}

				// 2. Get payment UTXOs from wallet
				const { paymentUtxos, nftUtxos } = await wallet.getUtxos();
				if (!paymentUtxos || paymentUtxos.length === 0) {
					throw new Error(
						"No payment UTXOs available to fund this transaction",
					);
				}

				// 3. Get the wallet address for change
				const walletAddress = paymentPk.toAddress().toString();

				// 4. Parse the inscription outpoint
				const [txid, voutStr] = args.inscriptionOutpoint.split("_");
				if (!txid || !voutStr) {
					throw new Error(
						"Invalid inscription outpoint format. Expected txid_vout",
					);
				}
				const vout = Number.parseInt(voutStr, 10);

				// 5. Find the inscription in nftUtxos
				const inscription = nftUtxos.find(
					(utxo) => utxo.txid === txid && utxo.vout === vout,
				);

				if (!inscription) {
					throw new Error(
						`Inscription ${args.inscriptionOutpoint} not found in your wallet`,
					);
				}

				// 6. Create config and transfer the inscription
				const sendOrdinalsConfig: SendOrdinalsConfig = {
					paymentPk,
					paymentUtxos,
					ordinals: [inscription],
					destinations: [{ address: args.destinationAddress }],
					changeAddress: walletAddress,
				};

				const identityKeyWif = process.env.IDENTITY_KEY_WIF;
				const identityPk = identityKeyWif
					? PrivateKey.fromWif(identityKeyWif)
					: undefined;
				if (identityPk) {
					sendOrdinalsConfig.signer = {
						idKey: identityPk,
					} as LocalSigner;
				}

				// Add metadata if provided
				if (args.metadata) {
					sendOrdinalsConfig.metaData = args.metadata;
				}

				// Using the wallet's key for both payment and ordinals
				sendOrdinalsConfig.ordPk = paymentPk;

				const result = await sendOrdinals(sendOrdinalsConfig);
				const changeResult = result as ChangeResult;
				// no signing when you send since we don't emit an inscription

				// 7. Broadcast the transaction
				const disableBroadcasting = process.env.DISABLE_BROADCASTING === "true";
				if (!disableBroadcasting) {
					await changeResult.tx.broadcast();

					// 8. Refresh the wallet's UTXOs after spending
					try {
						await wallet.refreshUtxos();
					} catch (refreshError) {
						console.warn(
							"Failed to refresh UTXOs after transaction:",
							refreshError,
						);
					}

					// 9. Return transaction details
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									txid: changeResult.tx.id("hex"),
									spentOutpoints: changeResult.spentOutpoints,
									payChange: changeResult.payChange,
									inscriptionOutpoint: args.inscriptionOutpoint,
									destinationAddress: args.destinationAddress,
								}),
							},
						],
					};
				}

				return {
					content: [
						{
							type: "text",
							text: changeResult.tx.toHex(),
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
