import type { OneSatContext } from "@1sat/actions";
import { type PrivateKey, Utils } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerA2bPublishMcpTool } from "./a2bPublishMcp";
import { registerCreateOrdinalsTool } from "./createOrdinals";
import { registerGatherCollectionInfoTool } from "./gatherCollectionInfo";
import { registerGetAddressTool } from "./getAddress";
import { registerWalletGetBalanceTool } from "./getBalance";
import { registerGetPublicKeyTool } from "./getPublicKey";
import { registerMintCollectionTool } from "./mintCollection";
import { registerPurchaseListingTool } from "./purchaseListing";
import { registerRefreshUtxosTool } from "./refreshUtxos";
import { walletEncryptionArgsSchema } from "./schemas";
import { registerSendToAddressTool } from "./sendToAddress";
import { registerTransferOrdTokenTool } from "./transferOrdToken";
import type { Wallet } from "./wallet";

export function registerWalletTools(
	server: McpServer,
	wallet: Wallet,
	config: {
		disableBroadcasting: boolean;
		enableA2bTools: boolean;
		identityPk?: PrivateKey;
		ctx?: OneSatContext;
	},
): void {
	// Register the wallet_sendToAddress tool
	registerSendToAddressTool(server, config.ctx);

	// Register the wallet_getAddress tool
	registerGetAddressTool(server, wallet);

	// Register the wallet_getPublicKey tool
	registerGetPublicKeyTool(server, wallet);

	// Register the wallet_purchaseListing tool
	registerPurchaseListingTool(server, config.ctx);

	// Register the wallet_transferOrdToken tool
	registerTransferOrdTokenTool(server, config.ctx);

	// Register the wallet_refreshUtxos tool
	registerRefreshUtxosTool(server, wallet);

	// Register the wallet_getBalance tool
	registerWalletGetBalanceTool(server, config.ctx);

	// A2B tools have to be explicitly enabled
	if (config.enableA2bTools) {
		// Register the wallet_a2bPublishMcp tool
		registerA2bPublishMcpTool(server, wallet, config.identityPk, {
			disableBroadcasting: config.disableBroadcasting,
		});
	}

	// Register combined wallet_encryption tool
	server.tool(
		"wallet_encryption",
		"Combined tool for encrypting and decrypting data using the wallet's cryptographic keys.\n\n" +
			"PARAMETERS:\n" +
			'- mode: (required) Either "encrypt" to encrypt plaintext or "decrypt" to decrypt ciphertext\n' +
			"- data: (required) Text string or array of numbers to process\n" +
			"- encoding: (optional) For text input, the encoding format (utf8, hex, base64) - default is utf8\n" +
			"- recipientPublicKeyHex: (optional) Hexadecimal representation of the recipient's public key (required for encrypt mode)\n\n" +
			"EXAMPLES:\n" +
			"1. Encrypt text data:\n" +
			"   {\n" +
			'     "mode": "encrypt",\n' +
			'     "data": "Hello World",\n' +
			'     "encoding": "utf8",\n' +
			'     "recipientPublicKeyHex": "020202020202020202020202020202020202020202020202020202020202020202"\n' +
			"   }\n\n" +
			"2. Decrypt previously encrypted data:\n" +
			"   {\n" +
			'     "mode": "decrypt",\n' +
			'     "data": [encrypted bytes from previous response]\n' +
			"   }",
		{ ...walletEncryptionArgsSchema.shape },
		async ({ mode, data, encoding, recipientPublicKeyHex }) => {
			try {

				let inputData: number[];
				if (typeof data === "string") {
					inputData = Utils.toArray(data, encoding || "utf8");
				} else {
					inputData = Array.from(data);
				}

				// let resultBuffer: Buffer;
				// let resultOutput: string | number[];

				if (mode === "encrypt") {
					// recipientPublicKeyHex is validated by Zod schema to be present for encrypt mode
					// The schema ensures recipientPublicKeyHex is defined here.
					// resultBuffer = await wallet.encrypt({
					// 	data: inputBuffer,
					// 	recipientPublicKeyHex: recipientPublicKeyHex as string, // Still needs type assertion if Zod optional isn't fully narrowed
					// });
					throw new Error("Encrypt method not yet implemented in wallet");
					// if (encoding === "utf8") {
					// 	resultOutput = Array.from(resultBuffer);
					// } else {
					// 	resultOutput = resultBuffer.toString(encoding || "base64");
					// }
				}
				// mode === "decrypt"
				// resultBuffer = await wallet.decrypt({ data: inputBuffer });
				throw new Error("Decrypt method not yet implemented in wallet");

				// return {
				// 	content: [
				// 		{ type: "text", text: JSON.stringify({ data: resultOutput }) },
				// 	],
				// };
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				return {
					content: [
						{
							type: "text",
							text: `Error during ${mode}: ${errorMessage}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	// Register createOrdinals tool
	registerCreateOrdinalsTool(server, config.ctx);

	// Register collection tools
	registerGatherCollectionInfoTool(server, wallet);
	registerMintCollectionTool(server, wallet);

}
