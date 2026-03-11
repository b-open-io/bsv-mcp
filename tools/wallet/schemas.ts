import { z } from "zod";

// Empty args schema for functions that don't take arguments
export const emptyArgsSchema = z.object({});

// Get public key arguments
export const getPublicKeyArgsSchema = z.object({});

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
		recipientPublicKeyHex: z
			.string()
			.length(66)
			.regex(/^(02|03)[0-9a-fA-F]{64}$/)
			.optional()
			.describe(
				"Recipient's public key in hex format (required for encryption mode)",
			),
	})
	.describe("Schema for encryption and decryption operations")
	.superRefine((val, ctx) => {
		if (val.mode === "encrypt" && !val.recipientPublicKeyHex) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "recipientPublicKeyHex is required when mode is 'encrypt'",
				path: ["recipientPublicKeyHex"],
			});
		}
	});

// Get address args
export const getAddressArgsSchema = z.object({});

/**
 * Schema for purchase listing arguments
 */
export const purchaseListingArgsSchema = z
	.object({
		listingOutpoint: z
			.string()
			.describe("The outpoint of the listing to purchase (txid_vout format)"),
		listingType: z
			.enum(["nft", "token"])
			.default("nft")
			.describe(
				"Type of listing: 'nft' for ordinal NFTs, 'token' for BSV21 tokens",
			),
		tokenID: z
			.string()
			.optional()
			.describe(
				"Token ID (txid_vout of deploy transaction) — required when listingType is 'token'",
			),
		tokenAmount: z
			.string()
			.optional()
			.describe(
				"Amount of tokens in the listing (as string) — required when listingType is 'token'",
			),
		description: z
			.string()
			.optional()
			.describe("Optional description for the transaction"),
	})
	.describe(
		"Schema for the wallet_purchaseListing tool arguments (purchase NFTs or BSV21 tokens).",
	);

// Export types
export type PurchaseListingArgs = z.infer<typeof purchaseListingArgsSchema>;
export type WalletEncryptionArgs = z.infer<typeof walletEncryptionArgsSchema>;
