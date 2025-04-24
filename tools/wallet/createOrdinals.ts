import { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { createOrdinals } from "js-1sat-ord";
import type {
	ChangeResult,
	CreateOrdinalsCollectionItemMetadata,
	CreateOrdinalsCollectionMetadata,
	CreateOrdinalsConfig,
	Destination,
	Inscription,
	LocalSigner,
	PreMAP,
} from "js-1sat-ord";
import { Sigma } from "sigma-protocol";
import { z } from "zod";
import type { Wallet } from "./wallet";

/**
 * Schema for the createOrdinals tool arguments.
 * This is a simplified interface compared to the full CreateOrdinalsConfig
 * in js-1sat-ord. The wallet will provide UTXOs, private key, etc.
 */
export const createOrdinalsArgsSchema = z.object({
	// Base64-encoded data to inscribe
	dataB64: z.string().describe("Base64-encoded content to inscribe"),
	// Content type (e.g., "image/jpeg", "text/plain", etc.)
	contentType: z.string().describe("MIME type of the content"),
	// Optional destination address (if not provided, uses the wallet's address)
	destinationAddress: z
		.string()
		.optional()
		.describe("Optional destination address for the ordinal"),
	// Optional metadata for the inscription
	metadata: z
		.any()
		.optional()
		.describe("Optional MAP metadata for the inscription"),
});

export type CreateOrdinalsArgs = z.infer<typeof createOrdinalsArgsSchema>;

/**
 * Registers the wallet_createOrdinals tool for minting ordinals/inscriptions
 */
export function registerCreateOrdinalsTool(server: McpServer, wallet: Wallet) {
	server.tool(
		"wallet_createOrdinals",
		"Creates and inscribes ordinals (NFTs) on the Bitcoin SV blockchain. This tool lets you mint new digital artifacts by encoding data directly into the blockchain. Supports various content types including images, text, JSON, and HTML. The tool handles transaction creation, fee calculation, and broadcasting.",
		{ args: createOrdinalsArgsSchema },
		async (
			{ args }: { args: CreateOrdinalsArgs },
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

				// 1. Get private key from wallet
				const paymentPk = wallet.getPrivateKey();
				if (!paymentPk) {
					throw new Error("No private key available in wallet");
				}

				// 2. Get payment UTXOs from wallet
				const { paymentUtxos } = await wallet.getUtxos();
				if (!paymentUtxos || paymentUtxos.length === 0) {
					throw new Error(
						"No payment UTXOs available to fund this inscription",
					);
				}

				// 3. Get the wallet address for change/destination if not provided
				const walletAddress = paymentPk.toAddress().toString();

				// 4. Create the inscription object
				const inscription: Inscription = {
					dataB64: args.dataB64,
					contentType: args.contentType,
				};

				// 5. Create the destination
				const destinations: Destination[] = [
					{
						address: args.destinationAddress || walletAddress,
						inscription,
					},
				];

				const createOrdinalsConfig: CreateOrdinalsConfig = {
					utxos: paymentUtxos,
					destinations,
					paymentPk,
					changeAddress: walletAddress,
					metaData: args.metadata as
						| PreMAP
						| CreateOrdinalsCollectionMetadata
						| CreateOrdinalsCollectionItemMetadata,
				};

				if (identityPk) {
					createOrdinalsConfig.signer = {
						idKey: identityPk,
					} as LocalSigner;
				}

				// 6. Create and broadcast the transaction
				const result = await createOrdinals(createOrdinalsConfig);

				const changeResult = result as ChangeResult;

				// 7. Optionally sign with identity key and broadcast the transaction

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
									inscriptionAddress: args.destinationAddress || walletAddress,
									contentType: args.contentType,
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
