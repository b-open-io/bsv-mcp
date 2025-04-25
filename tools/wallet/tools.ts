import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type {
	abortActionArgsSchema,
	acquireCertificateArgsSchema,
	createHmacArgsSchema,
	discoverByAttributesArgsSchema,
	discoverByIdentityKeyArgsSchema,
	getHeaderArgsSchema,
	internalizeActionArgsSchema,
	listActionsArgsSchema,
	listCertificatesArgsSchema,
	listOutputsArgsSchema,
	proveCertificateArgsSchema,
	relinquishCertificateArgsSchema,
	relinquishOutputArgsSchema,
	revealCounterpartyKeyLinkageArgsSchema,
	revealSpecificKeyLinkageArgsSchema,
	verifyHmacArgsSchema,
} from "./schemas";
import type { Wallet } from "./wallet";

import {
	createSignatureArgsSchema,
	type emptyArgsSchema,
	type getAddressArgsSchema,
	type getPublicKeyArgsSchema,
	type purchaseListingArgsSchema,
	type sendToAddressArgsSchema,
	verifySignatureArgsSchema,
	walletEncryptionArgsSchema,
} from "./schemas";

import { Utils, type WalletProtocol } from "@bsv/sdk";
import { registerCreateOrdinalsTool } from "./createOrdinals";
import type { createOrdinalsArgsSchema } from "./createOrdinals";
import { registerGetAddressTool } from "./getAddress";
import { registerGetPublicKeyTool } from "./getPublicKey";
import { registerPurchaseListingTool } from "./purchaseListing";
import { registerRefreshUtxosTool } from "./refreshUtxos";
import { registerSendToAddressTool } from "./sendToAddress";
import { registerTransferOrdTokenTool } from "./transferOrdToken";

import type { a2bPublishArgsSchema } from "./a2bPublishAgent";
import { registerA2bPublishMcpTool } from "./a2bPublishMcp";
import type { transferOrdTokenArgsSchema } from "./transferOrdToken";

// Define mapping from tool names to argument schemas
type ToolArgSchemas = {
	wallet_getPublicKey: typeof getPublicKeyArgsSchema;
	wallet_createSignature: typeof createSignatureArgsSchema;
	wallet_verifySignature: typeof verifySignatureArgsSchema;
	wallet_encryption: typeof walletEncryptionArgsSchema;
	wallet_listActions: typeof listActionsArgsSchema;
	wallet_listOutputs: typeof listOutputsArgsSchema;
	wallet_getNetwork: typeof emptyArgsSchema;
	wallet_getVersion: typeof emptyArgsSchema;
	wallet_revealCounterpartyKeyLinkage: typeof revealCounterpartyKeyLinkageArgsSchema;
	wallet_revealSpecificKeyLinkage: typeof revealSpecificKeyLinkageArgsSchema;
	wallet_createHmac: typeof createHmacArgsSchema;
	wallet_verifyHmac: typeof verifyHmacArgsSchema;
	wallet_abortAction: typeof abortActionArgsSchema;
	wallet_internalizeAction: typeof internalizeActionArgsSchema;
	wallet_relinquishOutput: typeof relinquishOutputArgsSchema;
	wallet_acquireCertificate: typeof acquireCertificateArgsSchema;
	wallet_listCertificates: typeof listCertificatesArgsSchema;
	wallet_proveCertificate: typeof proveCertificateArgsSchema;
	wallet_relinquishCertificate: typeof relinquishCertificateArgsSchema;
	wallet_discoverByIdentityKey: typeof discoverByIdentityKeyArgsSchema;
	wallet_discoverByAttributes: typeof discoverByAttributesArgsSchema;
	wallet_isAuthenticated: typeof emptyArgsSchema;
	wallet_waitForAuthentication: typeof emptyArgsSchema;
	wallet_getHeaderForHeight: typeof getHeaderArgsSchema;
	wallet_getAddress: typeof getAddressArgsSchema;
	wallet_sendToAddress: typeof sendToAddressArgsSchema;
	wallet_purchaseListing: typeof purchaseListingArgsSchema;
	wallet_transferOrdToken: typeof transferOrdTokenArgsSchema;
	wallet_a2bPublish: typeof a2bPublishArgsSchema;
	wallet_createOrdinals: typeof createOrdinalsArgsSchema;
	wallet_refreshUtxos: typeof emptyArgsSchema;
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
	registerGetAddressTool(server);

	// Register the wallet_getPublicKey tool
	registerGetPublicKeyTool(server, wallet);

	// Register the wallet_purchaseListing tool
	registerPurchaseListingTool(server, wallet);

	// Register the wallet_transferOrdToken tool
	registerTransferOrdTokenTool(server, wallet);

	// Register the wallet_refreshUtxos tool
	registerRefreshUtxosTool(server, wallet);

	// A2B tools have to be explicitly enabled
	if (config.enableA2bTools) {
		// Register the wallet_a2bPublishAgent tool
		// registerA2bPublishAgentTool(server, wallet);

		// Register the wallet_a2bPublishMcp tool
		registerA2bPublishMcpTool(server, wallet, {
			disableBroadcasting: config.disableBroadcasting,
		});
	}

	// Register only the minimal public-facing tools
	// wallet_createAction, wallet_signAction and wallet_getHeight have been removed

	// Register wallet_createSignature
	registerTool(
		"wallet_createSignature",
		"Creates a cryptographic signature using the wallet's private key. This tool enables secure message signing and transaction authorization, supporting various signature protocols.",
		{ args: createSignatureArgsSchema },
		async (
			{ args }: { args: z.infer<typeof createSignatureArgsSchema> },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		) => {
			try {
				const result = await wallet.createSignature(args);
				return { content: [{ type: "text", text: JSON.stringify(result) }] };
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);

	// Register wallet_verifySignature
	registerTool(
		"wallet_verifySignature",
		"Verifies a cryptographic signature against a message or data. This tool supports various verification protocols and can validate signatures from both the wallet's own keys and external public keys.",
		{ args: verifySignatureArgsSchema },
		async (
			{ args }: { args: z.infer<typeof verifySignatureArgsSchema> },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		) => {
			try {
				const result = await wallet.verifySignature(args);
				return { content: [{ type: "text", text: JSON.stringify(result) }] };
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);

	// Register combined wallet_encryption tool
	registerTool(
		"wallet_encryption",
		"Combined tool for encrypting and decrypting data using the wallet's cryptographic keys.\n\n" +
			"PARAMETERS:\n" +
			'- mode: (required) Either "encrypt" to encrypt plaintext or "decrypt" to decrypt ciphertext\n' +
			"- data: (required) Text string or array of numbers to process\n" +
			"- encoding: (optional) For text input, the encoding format (utf8, hex, base64) - default is utf8\n\n" +
			"EXAMPLES:\n" +
			"1. Encrypt text data:\n" +
			"   {\n" +
			'     "mode": "encrypt",\n' +
			'     "data": "Hello World"\n' +
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
				const { mode, data, encoding } = args;

				// Set default values for required parameters
				const protocolID: WalletProtocol = [1, "aes256"];
				const keyID = "default";

				// Convert string data to binary if needed
				let binaryData: number[];
				if (Array.isArray(data)) {
					binaryData = data;
				} else {
					// String data with encoding
					const { toArray } = Utils;
					binaryData = toArray(data, encoding || "utf8");
				}

				let result: { ciphertext?: number[]; plaintext?: number[] | string } =
					{};
				if (mode === "encrypt") {
					result = await wallet.encrypt({
						plaintext: binaryData,
						protocolID,
						keyID,
					});
				} else if (mode === "decrypt") {
					result = await wallet.decrypt({
						ciphertext: binaryData,
						protocolID,
						keyID,
					});

					// For decryption, convert plaintext back to string if it's likely UTF-8 text
					if (result.plaintext as number[]) {
						try {
							const { toUTF8 } = Utils;
							const textResult = toUTF8(result.plaintext as number[]);
							// If conversion succeeds and seems like valid text, return as string
							if (textResult && textResult.length > 0) {
								return {
									content: [
										{
											type: "text",
											text: JSON.stringify({ plaintext: textResult }),
										},
									],
								};
							}
						} catch (e) {
							// If UTF-8 conversion fails, continue with binary result
						}
					}
				}

				return { content: [{ type: "text", text: JSON.stringify(result) }] };
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

	return handlers;
}
