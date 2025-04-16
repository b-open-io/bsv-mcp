import type {
	McpServer,
	ToolCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { convertData } from "../utils/conversion";
import { registerGetAddressTool } from "./getAddress";
import { registerPurchaseListingTool } from "./purchaseListing";
import {
	createSignatureArgsSchema,
	type emptyArgsSchema,
	getPublicKeyArgsSchema,
	verifySignatureArgsSchema,
	walletDecryptArgsSchema,
	walletEncryptArgsSchema,
} from "./schemas";
import type {
	abortActionArgsSchema,
	acquireCertificateArgsSchema,
	createHmacArgsSchema,
	discoverByAttributesArgsSchema,
	discoverByIdentityKeyArgsSchema,
	getAddressArgsSchema,
	getHeaderArgsSchema,
	internalizeActionArgsSchema,
	listActionsArgsSchema,
	listCertificatesArgsSchema,
	listOutputsArgsSchema,
	proveCertificateArgsSchema,
	purchaseListingArgsSchema,
	relinquishCertificateArgsSchema,
	relinquishOutputArgsSchema,
	revealCounterpartyKeyLinkageArgsSchema,
	revealSpecificKeyLinkageArgsSchema,
	sendToAddressArgsSchema,
	verifyHmacArgsSchema,
} from "./schemas";
import { registerSendToAddressTool } from "./sendToAddress";
import type { Wallet } from "./wallet";

// Define mapping from tool names to argument schemas
type ToolArgSchemas = {
	wallet_getPublicKey: typeof getPublicKeyArgsSchema;
	wallet_createSignature: typeof createSignatureArgsSchema;
	wallet_verifySignature: typeof verifySignatureArgsSchema;
	wallet_encrypt: typeof walletEncryptArgsSchema;
	wallet_decrypt: typeof walletDecryptArgsSchema;
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
		schema: { args: T },
		handler: ToolCallback<{ args: T }>,
	): void {
		// Register all tools normally
		server.tool(name, schema, handler);
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

	// Register wallet_encrypt
	registerTool(
		"wallet_encrypt",
		{ args: walletEncryptArgsSchema },
		async (
			{ args }: { args: z.infer<typeof walletEncryptArgsSchema> },
			extra: RequestHandlerExtra,
		) => {
			try {
				const result = await wallet.encrypt(args);
				return { content: [{ type: "text", text: JSON.stringify(result) }] };
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);

	// Register wallet_decrypt
	registerTool(
		"wallet_decrypt",
		{ args: walletDecryptArgsSchema },
		async (
			{ args }: { args: z.infer<typeof walletDecryptArgsSchema> },
			extra: RequestHandlerExtra,
		) => {
			try {
				const result = await wallet.decrypt(args);
				return { content: [{ type: "text", text: JSON.stringify(result) }] };
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);

	return handlers;
}
