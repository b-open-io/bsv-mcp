import { HD, PrivateKey, PublicKey } from "@bsv/sdk";
import { z } from "zod";

// Yours' legacy defaults, verified against yours-wallet/src/utils/constants.ts.
// These are not BRC-157 profiles and are never converted into hardened profiles.
export const YOURS_LEGACY_PROFILE_PATHS = [
	"m/44'/236'/0'/1/0",
	"m/44'/236'/1'/0/0",
	"m/0'/236'/0'/0/0",
] as const;

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/);
const publicKeySchema = z
	.string()
	.regex(/^(02|03)[0-9a-f]{64}$/)
	.refine((value) => {
		try {
			const key = PublicKey.fromString(value);
			return key.validate() && key.toString() === value;
		} catch {
			return false;
		}
	});

/** Matches the existing project's explicit BRC-42 leaf parameters. */
export const vaultProfileLeafSchema = z
	.object({
		scheme: z.literal("brc42"),
		protocolID: z.tuple([
			z.union([z.literal(0), z.literal(1), z.literal(2)]),
			z
				.string()
				.min(5)
				.max(400)
				.regex(/^[a-z0-9]+(?: [a-z0-9]+)*$/)
				.refine((name) => !name.endsWith(" protocol")),
		]),
		keyID: z.string().min(1).max(800),
		counterparty: z.union([z.enum(["self", "anyone"]), publicKeySchema]),
	})
	.strict();

/**
 * BRC-157 is exactly m/0'/index' in @opl.dev/vault. Its root is not a
 * signing leaf: callers must explicitly select a BRC-42 child as well.
 * The Yours variant selects one known legacy path from an existing HD master.
 */
export const vaultProfileDerivationSchema = z.discriminatedUnion("scheme", [
	z
		.object({
			scheme: z.literal("brc157"),
			index: z.number().int().min(0).max(0x7fffffff),
			leaf: vaultProfileLeafSchema,
		})
		.strict(),
	z
		.object({
			scheme: z.literal("yours-legacy-bip32"),
			path: z.enum(YOURS_LEGACY_PROFILE_PATHS),
		})
		.strict(),
]);

export type VaultProfileDerivation = z.infer<
	typeof vaultProfileDerivationSchema
>;

const referenceSchema = z
	.object({
		vaultId: identifier,
		entryId: identifier,
		derivation: vaultProfileDerivationSchema,
	})
	.strict();
const selectionSchema = referenceSchema.extend({
	expectedPublicKey: publicKeySchema,
});

export type VaultProfileReference = z.infer<typeof referenceSchema>;
export type VaultProfileSelection = z.infer<typeof selectionSchema>;

/**
 * A caller-owned, pinned local unlock session. Vault.reveal checks its reveal
 * policy but not the signer's TTL; assertActive MUST enforce the controller's
 * lock/expiry state. This adapter never unlocks, imports, saves, or exports.
 */
export interface VaultProfileAccess {
	readonly id: string;
	assertActive(): void;
	get(entryId: string): { kind: string };
	reveal(entryId: string, reason: string): string;
}

/** The actual public pure derivation exports of @opl.dev/vault 0.0.1. */
export interface VaultProfileDerivationApi {
	mnemonicToEntropy(words: string): string;
	brc157Profile(entropyHex: string, index: number): { toHex(): string };
	brc42Derive(
		rootWif: string,
		protocolID: [0 | 1 | 2, string],
		keyID: string,
		counterparty: string,
	): { toHex(): string };
	bip32Derive(xkey: string, path: string): string;
}

export class VaultProfileDerivationError extends Error {
	constructor(readonly code: string) {
		super(code);
		this.name = "VaultProfileDerivationError";
	}
}

function fail(code: string): never {
	throw new VaultProfileDerivationError(code);
}

function assertSession(access: VaultProfileAccess) {
	try {
		access.assertActive();
	} catch {
		fail("VAULT_PROFILE_SESSION_UNAVAILABLE");
	}
}

function deriveKey(
	access: VaultProfileAccess,
	reference: VaultProfileReference,
	reason: string,
	api: VaultProfileDerivationApi,
): PrivateKey {
	if (typeof reason !== "string" || !reason.trim() || reason.length > 200)
		fail("VAULT_PROFILE_REASON_REQUIRED");
	if (access.id !== reference.vaultId) fail("VAULT_PROFILE_VAULT_MISMATCH");
	assertSession(access);
	let kind: string;
	try {
		kind = access.get(reference.entryId).kind;
	} catch {
		fail("VAULT_PROFILE_ENTRY_UNAVAILABLE");
	}
	const descriptor = reference.derivation;
	if (
		descriptor.scheme === "brc157"
			? kind !== "entropy" && kind !== "mnemonic"
			: kind !== "hd-private"
	)
		fail("VAULT_PROFILE_SOURCE_UNSUPPORTED");

	// Validate available SDK exports before requesting any secret material.
	const functions =
		descriptor.scheme === "brc157"
			? [
					api.brc157Profile,
					api.brc42Derive,
					...(kind === "mnemonic" ? [api.mnemonicToEntropy] : []),
				]
			: [api.bip32Derive];
	if (functions.some((fn) => typeof fn !== "function"))
		fail("VAULT_PROFILE_API_UNAVAILABLE");
	assertSession(access);
	let value: string;
	try {
		value = access.reveal(reference.entryId, reason);
	} catch {
		fail("VAULT_PROFILE_REVEAL_DENIED");
	}
	let key: PrivateKey;
	try {
		if (descriptor.scheme === "brc157") {
			const entropy =
				kind === "mnemonic" ? api.mnemonicToEntropy(value) : value;
			const profile = PrivateKey.fromHex(
				api.brc157Profile(entropy, descriptor.index).toHex(),
			);
			const { protocolID, keyID, counterparty } = descriptor.leaf;
			key = PrivateKey.fromHex(
				api
					.brc42Derive(profile.toWif(), protocolID, keyID, counterparty)
					.toHex(),
			);
		} else {
			const master = HD.fromString(value);
			if (master.depth !== 0 || !master.privKey?.isValid())
				fail("VAULT_PROFILE_HD_MASTER_REQUIRED");
			key = HD.fromString(api.bip32Derive(value, descriptor.path)).privKey;
		}
		if (!key?.isValid()) fail("VAULT_PROFILE_DERIVATION_FAILED");
	} catch (error) {
		if (error instanceof VaultProfileDerivationError) throw error;
		// SDK/adapter errors may include source material; never forward them.
		fail("VAULT_PROFILE_DERIVATION_FAILED");
	} finally {
		value = "";
	}
	assertSession(access);
	return key;
}

/**
 * Public preview still needs a local session because Vault has no public-only
 * BRC-157 profile derivation API. Only the compressed leaf identity is returned.
 */
export function deriveVaultProfilePublicKey(
	access: VaultProfileAccess,
	input: unknown,
	reason: string,
	api: VaultProfileDerivationApi,
): string {
	const parsed = referenceSchema.safeParse(input);
	if (!parsed.success) fail("VAULT_PROFILE_DESCRIPTOR_UNSUPPORTED");
	return deriveKey(access, parsed.data, reason, api).toPublicKey().toString();
}

/**
 * Resolve an explicitly pinned leaf for in-memory use. The caller owns its
 * lifetime and must never serialize it. JavaScript cannot guarantee zeroization.
 */
export function resolveVaultProfilePrivateKey(
	access: VaultProfileAccess,
	input: unknown,
	reason: string,
	api: VaultProfileDerivationApi,
): PrivateKey {
	const parsed = selectionSchema.safeParse(input);
	if (!parsed.success) fail("VAULT_PROFILE_DESCRIPTOR_UNSUPPORTED");
	const key = deriveKey(access, parsed.data, reason, api);
	if (key.toPublicKey().toString() !== parsed.data.expectedPublicKey)
		fail("VAULT_PROFILE_PUBLIC_KEY_MISMATCH");
	return key;
}
