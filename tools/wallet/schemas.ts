import type { SecurityLevel } from "@bsv/sdk";
import { z } from "zod";

// Define SecurityLevel to match the BSV SDK exactly
const SecurityLevelEnum = z.union([z.literal(0), z.literal(1), z.literal(2)]);

// Create a custom validator without tuples
export const walletProtocolSchema = z.custom<[SecurityLevel, string]>((val) => {
	return (
		Array.isArray(val) &&
		val.length === 2 &&
		(val[0] === 0 || val[0] === 1 || val[0] === 2) &&
		typeof val[1] === "string"
	);
});

// Empty args schema for functions that don't take arguments
export const emptyArgsSchema = z.object({});

// Get public key arguments
export const getPublicKeyArgsSchema = z.object({});

// Create signature arguments
export const createSignatureArgsSchema = z.object({
	data: z.array(z.number()).optional(),
	hashToDirectlySign: z.array(z.number()).optional(),
	protocolID: walletProtocolSchema,
	keyID: z.string(),
	privilegedReason: z.string().optional(),
	counterparty: z
		.union([z.string(), z.literal("self"), z.literal("anyone")])
		.optional(),
	privileged: z.boolean().optional(),
});

// Verify signature arguments
export const verifySignatureArgsSchema = z.object({
	data: z.array(z.number()).optional(),
	hashToDirectlyVerify: z.array(z.number()).optional(),
	signature: z.array(z.number()),
	protocolID: walletProtocolSchema,
	keyID: z.string(),
	privilegedReason: z.string().optional(),
	counterparty: z
		.union([z.string(), z.literal("self"), z.literal("anyone")])
		.optional(),
	forSelf: z.boolean().optional(),
	privileged: z.boolean().optional(),
});

// Wallet encryption args
export const walletEncryptArgsSchema = z.object({
	plaintext: z.array(z.number()),
	protocolID: walletProtocolSchema,
	keyID: z.string(),
	privilegedReason: z.string().optional(),
	counterparty: z
		.union([z.string(), z.literal("self"), z.literal("anyone")])
		.optional(),
	privileged: z.boolean().optional(),
});

// Wallet decryption args
export const walletDecryptArgsSchema = z.object({
	ciphertext: z.array(z.number()),
	protocolID: walletProtocolSchema,
	keyID: z.string(),
	privilegedReason: z.string().optional(),
	counterparty: z
		.union([z.string(), z.literal("self"), z.literal("anyone")])
		.optional(),
	privileged: z.boolean().optional(),
});

// Combined wallet encryption/decryption args
export const walletEncryptionArgsSchema = z
	.object({
		mode: z
			.enum(["encrypt", "decrypt"])
			.describe(
				"Operation mode: 'encrypt' to encrypt plaintext or 'decrypt' to decrypt data",
			),
		data: z
			.union([
				z.string().describe("Text data to encrypt or decrypt"),
				z.array(z.number()).describe("Binary data to encrypt or decrypt"),
			])
			.describe("Data to process: text/data for encryption or decryption"),
		encoding: z
			.enum(["utf8", "hex", "base64"])
			.optional()
			.default("utf8")
			.describe("Encoding of text data (default: utf8)"),
	})
	.describe("Schema for encryption and decryption operations");

// Create HMAC arguments
export const createHmacArgsSchema = z.object({
	message: z.string(),
	encoding: z.enum(["utf8", "hex", "base64"]).optional(),
});

// Verify HMAC arguments
export const verifyHmacArgsSchema = z.object({
	message: z.string(),
	hmac: z.string(),
	publicKey: z.string(),
	encoding: z.enum(["utf8", "hex", "base64"]).optional(),
});

// Transaction input schema
export const transactionInputSchema = z.object({
	outpoint: z.string(),
	inputDescription: z.string(), // Required field
	sequence: z.number().optional(),
});

// Transaction output schema
export const transactionOutputSchema = z.object({
	lockingScript: z.string(),
	satoshis: z.number(),
	outputDescription: z.string(), // Required field
	change: z.boolean().optional(),
});

// Create action args
export const createActionArgsSchema = z.object({
	description: z.string(),
	labels: z.array(z.string()).optional(),
	lockTime: z.number().optional(),
	version: z.number().optional(),
	inputBEEF: z.array(z.number()).optional(),
	inputs: z.array(transactionInputSchema).optional(),
	outputs: z.array(transactionOutputSchema).optional(),
	options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

// Sign action args
export const signActionArgsSchema = z.object({
	reference: z.string(),
	spends: z.record(z.any()).optional(),
	options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

// List actions args
export const listActionsArgsSchema = z.object({
	labels: z.array(z.string()),
	labelQueryMode: z.enum(["any", "all"]).optional(),
	limit: z.number().optional(),
	offset: z.number().optional(),
	includeInputs: z.boolean().optional(),
	includeOutputs: z.boolean().optional(),
	includeLabels: z.boolean().optional(),
	includeInputSourceLockingScripts: z.boolean().optional(),
	includeInputUnlockingScripts: z.boolean().optional(),
	seekPermission: z.boolean().optional(),
});

// List outputs args
export const listOutputsArgsSchema = z.object({
	basket: z.string(),
	tags: z.array(z.string()).optional(),
	tagQueryMode: z.enum(["all", "any"]).optional(),
	limit: z.number().optional(),
	offset: z.number().optional(),
	include: z.enum(["locking scripts", "entire transactions"]).optional(),
	includeLabels: z.boolean().optional(),
	includeTags: z.boolean().optional(),
	includeCustomInstructions: z.boolean().optional(),
	seekPermission: z.boolean().optional(),
});

// Reveal counterparty key linkage args
export const revealCounterpartyKeyLinkageArgsSchema = z.object({
	counterparty: z.string(),
	verifier: z.string(),
	privileged: z.boolean().optional(),
	privilegedReason: z.string().optional(),
});

// Reveal specific key linkage args
export const revealSpecificKeyLinkageArgsSchema = z.object({
	keyID: z.number(),
	verifier: z.string(),
	privileged: z.boolean().optional(),
	privilegedReason: z.string().optional(),
});

// Abort action args
export const abortActionArgsSchema = z.object({
	reference: z.string(),
});

// Internalize action args
export const internalizeActionArgsSchema = z.object({
	tx: z.array(z.number()),
	outputs: z.array(
		z.object({
			outputIndex: z.number(),
			protocol: z.enum(["wallet payment", "basket insertion"]),
			lockingScript: z.string(),
			satoshis: z.number(),
		}),
	),
	description: z.string(),
	labels: z.array(z.string()).optional(),
	seekPermission: z.boolean().optional(),
});

// Relinquish output args
export const relinquishOutputArgsSchema = z.object({
	basket: z.string(),
	output: z.string(),
});

// Acquire certificate args
export const acquireCertificateArgsSchema = z.object({
	type: z.string(),
	certifier: z.string(),
	acquisitionProtocol: z.enum(["direct", "issuance"]),
	fields: z.record(z.string()),
	certifierUrl: z.string().optional(),
	serialNumber: z.string().optional(),
	signature: z.string().optional(),
	revocationOutpoint: z.string().optional(),
	keyringForSubject: z.record(z.string()).optional(),
	keyringRevealer: z.string().optional(),
	privileged: z.boolean().optional(),
	privilegedReason: z.string().optional(),
});

// List certificates args
export const listCertificatesArgsSchema = z.object({
	certifiers: z.array(z.string()),
	types: z.array(z.string()),
	limit: z.number().optional(),
	offset: z.number().optional(),
	privileged: z.boolean().optional(),
	privilegedReason: z.string().optional(),
});

// Prove certificate args
export const proveCertificateArgsSchema = z.object({
	certificate: z.object({}),
	fieldsToReveal: z.array(z.string()),
	verifier: z.string(),
	privileged: z.boolean().optional(),
	privilegedReason: z.string().optional(),
});

// Relinquish certificate args
export const relinquishCertificateArgsSchema = z.object({
	type: z.string(),
	serialNumber: z.string(),
	certifier: z.string(),
});

// Discover by identity key args
export const discoverByIdentityKeyArgsSchema = z.object({
	identityKey: z.string(),
	limit: z.number().optional(),
	offset: z.number().optional(),
	seekPermission: z.boolean().optional(),
});

// Discover by attributes args
export const discoverByAttributesArgsSchema = z.object({
	attributes: z.record(z.string()),
	limit: z.number().optional(),
	offset: z.number().optional(),
	seekPermission: z.boolean().optional(),
});

// Get header for height args
export const getHeaderArgsSchema = z.object({
	height: z.number(),
});

// Get address args
export const getAddressArgsSchema = z.object({});

// Send to address args
export const sendToAddressArgsSchema = z.object({
	address: z.string(),
	amount: z.number(),
	currency: z.enum(["BSV", "USD"]).optional().default("BSV"),
	description: z.string().optional(),
});

/**
 * Schema for purchase listing arguments
 */
export const purchaseListingArgsSchema = z
	.object({
		listingOutpoint: z
			.string()
			.describe("The outpoint of the listing to purchase (txid_vout format)"),
		ordAddress: z
			.string()
			.describe("The ordinal address to receive the purchased item"),
		listingType: z
			.enum(["nft", "token"])
			.default("nft")
			.describe(
				"Type of listing: 'nft' for ordinal NFTs, 'token' for BSV-20 tokens",
			),
		tokenProtocol: z
			.enum(["bsv-20", "bsv-21"])
			.optional()
			.default("bsv-21")
			.describe(
				"Token protocol for token listings (required when listingType is 'token')",
			),
		tokenID: z
			.string()
			.optional()
			.describe(
				"Token ID for BSV-21 tokens or ticker for BSV-20 tokens (required when listingType is 'token')",
			),
		description: z
			.string()
			.optional()
			.describe("Optional description for the transaction"),
	})
	.describe(
		"Schema for the wallet_purchaseListing tool arguments (purchase NFTs or tokens), with detailed field descriptions.",
	);

// Export types
export type SendToAddressArgs = z.infer<typeof sendToAddressArgsSchema>;
export type PurchaseListingArgs = z.infer<typeof purchaseListingArgsSchema>;
export type WalletEncryptionArgs = z.infer<typeof walletEncryptionArgsSchema>;
