import type { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import {
	type a2bPublishMcpArgsSchema,
	registerA2bPublishMcpTool,
} from "./a2bPublishMcp";
import {
	type createOrdinalsArgsSchema,
	registerCreateOrdinalsTool,
} from "./createOrdinals";
import { registerGatherCollectionInfoTool } from "./gatherCollectionInfo";
import { registerGetAddressTool } from "./getAddress";
import { registerWalletGetBalanceTool } from "./getBalance";
import { registerGetPublicKeyTool } from "./getPublicKey";
import { registerMintCollectionTool } from "./mintCollection";
import { registerPurchaseListingTool } from "./purchaseListing";
import { registerRefreshUtxosTool } from "./refreshUtxos";
import {
	type emptyArgsSchema,
	type getAddressArgsSchema,
	type getPublicKeyArgsSchema,
	type purchaseListingArgsSchema,
	type sendToAddressArgsSchema,
	walletEncryptionArgsSchema,
} from "./schemas";
import { registerSendToAddressTool } from "./sendToAddress";
import {
	registerTransferOrdTokenTool,
	type transferOrdTokenArgsSchema,
} from "./transferOrdToken";
import type { Wallet } from "./wallet";

// Define mapping from tool names to argument schemas
type ToolArgSchemas = {
	wallet_getPublicKey: typeof getPublicKeyArgsSchema;
	wallet_encryption: typeof walletEncryptionArgsSchema;
	wallet_getAddress: typeof getAddressArgsSchema;
	wallet_sendToAddress: typeof sendToAddressArgsSchema;
	wallet_purchaseListing: typeof purchaseListingArgsSchema;
	wallet_transferOrdToken: typeof transferOrdTokenArgsSchema;
	wallet_a2bPublish: typeof a2bPublishMcpArgsSchema;
	wallet_createOrdinals: typeof createOrdinalsArgsSchema;
	wallet_refreshUtxos: typeof emptyArgsSchema;
	wallet_getBalance: typeof emptyArgsSchema;
};

// Define a type for the handler function with proper argument types
type ToolHandler = (
	params: { args: unknown },
	extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
) => Promise<CallToolResult>;

// Define a map type for tool name to handler functions
type ToolHandlerMap = {
	[K in keyof ToolArgSchemas]: ToolHandler;
};

export function registerWalletTools(
	server: McpServer,
	wallet: Wallet,
	config: {
		disableBroadcasting: boolean;
		enableA2bTools: boolean;
		identityPk?: PrivateKey;
	},
): ToolHandlerMap {
	const handlers = {} as ToolHandlerMap;

	// Handle tools registration with properly typed parameters
	function registerTool<T extends z.ZodType>(
		name: keyof ToolArgSchemas,
		description: string,
		schema: { args: T },
		handler: ToolCallback<{ args: T }>,
	): void {
		// Register all tools normally
		server.tool(name, description, schema, handler);
		handlers[name] = handler as ToolHandler;
	}

	// Register the wallet_sendToAddress tool
	registerSendToAddressTool(server, wallet);

	// Register the wallet_getAddress tool
	registerGetAddressTool(server, wallet);

	// Register the wallet_getPublicKey tool
	registerGetPublicKeyTool(server, wallet);

	// Register the wallet_purchaseListing tool
	registerPurchaseListingTool(server, wallet);

	// Register the wallet_transferOrdToken tool
	registerTransferOrdTokenTool(server, wallet);

	// Register the wallet_refreshUtxos tool
	registerRefreshUtxosTool(server, wallet);

	// Register the wallet_getBalance tool
	registerWalletGetBalanceTool(server, wallet);

	// A2B tools have to be explicitly enabled
	if (config.enableA2bTools) {
		// Register the wallet_a2bPublishMcp tool
		registerA2bPublishMcpTool(server, wallet, config.identityPk, {
			disableBroadcasting: config.disableBroadcasting,
		});
	}

	// Register combined wallet_encryption tool
	registerTool(
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
		{ args: walletEncryptionArgsSchema },
		async (
			{ args }: { args: z.infer<typeof walletEncryptionArgsSchema> },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		) => {
			try {
				const { mode, data, encoding, recipientPublicKeyHex } = args;

				let inputBuffer: Buffer;
				if (typeof data === "string") {
					inputBuffer = Buffer.from(data, encoding || "utf8");
				} else {
					inputBuffer = Buffer.from(Uint8Array.from(data));
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
							text: `Error during ${args.mode}: ${errorMessage}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	// Register createOrdinals tool
	registerCreateOrdinalsTool(server, wallet);

	// Register collection tools
	registerGatherCollectionInfoTool(server, wallet);
	registerMintCollectionTool(server, wallet);

	return handlers;
}
