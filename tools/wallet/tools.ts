import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
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
	getPublicKeyArgsSchema,
	type purchaseListingArgsSchema,
	type sendToAddressArgsSchema,
	verifySignatureArgsSchema,
	walletEncryptionArgsSchema,
} from "./schemas";

import { registerCreateOrdinalsTool } from "./createOrdinals";
import type { createOrdinalsArgsSchema } from "./createOrdinals";
import { registerGetAddressTool } from "./getAddress";
import { registerPurchaseListingTool } from "./purchaseListing";
import { registerSendToAddressTool } from "./sendToAddress";

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
	wallet_createOrdinals: typeof createOrdinalsArgsSchema;
};

// Define a type for the handler function with proper argument types
type ToolHandler = (
	params: { args: unknown },
	extra: RequestHandlerExtra,
) => Promise<CallToolResult>;

// Define a map type for tool name to handler functions
type ToolHandlerMap = {
	[K in keyof ToolArgSchemas]: ToolHandler;
};

export function registerWalletTools(
	server: McpServer,
	wallet: Wallet,
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

	// Register the wallet_purchaseListing tool
	registerPurchaseListingTool(server, wallet);

	// Register only the minimal public-facing tools
	// wallet_createAction, wallet_signAction and wallet_getHeight have been removed

	// Register wallet_getPublicKey
	registerTool(
		"wallet_getPublicKey",
		"Retrieves the current wallet's public key. This public key can be used for cryptographic operations like signature verification or encryption.",
		{ args: getPublicKeyArgsSchema },
		async (
			{ args }: { args: z.infer<typeof getPublicKeyArgsSchema> },
			extra: RequestHandlerExtra,
		) => {
			try {
				const result = await wallet.getPublicKey(args);
				return { content: [{ type: "text", text: JSON.stringify(result) }] };
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);

	// Register wallet_createSignature
	registerTool(
		"wallet_createSignature",
		"Creates a cryptographic signature using the wallet's private key. This tool enables secure message signing and transaction authorization, supporting various signature protocols.",
		{ args: createSignatureArgsSchema },
		async (
			{ args }: { args: z.infer<typeof createSignatureArgsSchema> },
			extra: RequestHandlerExtra,
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
			extra: RequestHandlerExtra,
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
		"Combined tool for encrypting and decrypting data using the wallet's cryptographic keys. Supports both encryption of plaintext data and decryption of previously encrypted content. Use the 'mode' parameter to switch between operations.",
		{ args: walletEncryptionArgsSchema },
		async (
			{ args }: { args: z.infer<typeof walletEncryptionArgsSchema> },
			extra: RequestHandlerExtra,
		) => {
			try {
				let result: { ciphertext?: number[]; plaintext?: number[] };
				if (args.mode === "encrypt") {
					// For encryption, the data is treated as plaintext
					result = await wallet.encrypt({
						plaintext: args.data,
						protocolID: args.protocolID,
						keyID: args.keyID,
						privilegedReason: args.privilegedReason,
						counterparty: args.counterparty,
						privileged: args.privileged,
					});
				} else {
					// For decryption, the data is treated as ciphertext
					result = await wallet.decrypt({
						ciphertext: args.data,
						protocolID: args.protocolID,
						keyID: args.keyID,
						privilegedReason: args.privilegedReason,
						counterparty: args.counterparty,
						privileged: args.privileged,
					});
				}
				return { content: [{ type: "text", text: JSON.stringify(result) }] };
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);

	// Register createOrdinals tool
	registerCreateOrdinalsTool(server, wallet);
	
	return handlers;
}
