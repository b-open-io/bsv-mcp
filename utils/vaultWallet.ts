import { isAbsolute } from "node:path";
import { KeyDeriver, PrivateKey, type WalletInterface } from "@bsv/sdk";
import { z } from "zod";
import { accountNameSchema } from "./accounts";
import {
	resolveVaultProfileBindingKey,
	vaultProfileBindingSchema,
} from "./vaultProfileBinding";
import {
	type VaultProfileDerivationApi,
	vaultProfileDerivationSchema,
	vaultProfileLeafSchema,
} from "./vaultProfileDerivation";
import { initWallet, type WalletInitResult } from "./walletInit";
import { walletStorageForKey } from "./walletKeyStorage";

/** Public, immutable selection from a trusted project-role resolver. */
export const vaultWalletBindingSchema = z
	.object({
		projectId: z.string().min(1),
		revision: z.number().int().nonnegative(),
		bindingId: z.string().min(1),
		accountId: z.string().min(1),
		vaultId: z.string().min(1),
		entryId: z.string().min(1),
		expectedPublicKey: z.string().regex(/^(02|03)[0-9a-fA-F]{64}$/),
		keyUseContract: z.enum([
			"direct-v1",
			"brc42-leaf-v1",
			"brc157-leaf-v1",
			"yours-legacy-leaf-v1",
		]),
		derivation: z
			.union([vaultProfileDerivationSchema, vaultProfileLeafSchema])
			.optional(),
	})
	.strict()
	.superRefine((binding, ctx) => {
		const valid =
			binding.keyUseContract === "direct-v1"
				? binding.derivation === undefined
				: binding.keyUseContract === "brc42-leaf-v1"
					? binding.derivation?.scheme === "brc42"
					: vaultProfileBindingSchema.safeParse({
							keyUseContract: binding.keyUseContract,
							key: {
								vaultId: binding.vaultId,
								entryId: binding.entryId,
								expectedPublicKey: binding.expectedPublicKey,
								derivation: binding.derivation,
							},
						}).success;
		if (!valid)
			ctx.addIssue({
				code: "custom",
				path: ["derivation"],
				message: "Explicit contract and derivation must match",
			});
	});

export type VaultWalletBinding = z.infer<typeof vaultWalletBindingSchema>;

export interface VaultWalletSelection {
	binding: VaultWalletBinding;
	/** Machine-local resolution, never a request-controlled path. */
	vaultPath: string;
	/** Existing account whose database and storage configuration remain in use. */
	accountName: string;
	chain: "main" | "test";
	reason: string;
	ttlSeconds?: number;
}

export type VaultWalletState = "ready" | "locked" | "expired";

export class VaultWalletError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "VaultWalletError";
	}
}

/** The small supported Vault surface used after decryption. */
export interface VaultWalletAccess {
	readonly id: string;
	get(id: string): { kind: string; publicKey?: string };
	unlock(reason: string, ttlSeconds: number): void;
	reveal(id: string, reason: string): string;
	lock(): void;
}

/** Passphrases are local-controller input, never MCP tool arguments. */
export type VaultWalletLoader = (
	path: string,
	passphrase: string,
) => Promise<VaultWalletAccess>;

interface OplVaultAccess {
	get(id: string): { kind: string; publicKey?: string };
	unlock(reason: string, ttlSeconds?: number): void;
	reveal(id: string, reason: string): string;
	lock(): void;
	toDocument(): { id: string };
}

/**
 * Adapt the real @opl.dev/vault exports without an unpublished dependency or
 * a machine-specific import. The application supplies its installed module.
 * No CLI export, plaintext file, saveVault, or reveal-policy bypass is used.
 */
export function createOplVaultLoader<Provider>(module: {
	PassphraseProvider: new (passphrase: string) => Provider;
	openVault(path: string, provider: Provider): Promise<OplVaultAccess>;
}): VaultWalletLoader {
	return async (path, passphrase) => {
		let vault: OplVaultAccess | undefined;
		try {
			vault = await module.openVault(
				path,
				new module.PassphraseProvider(passphrase),
			);
			// Vault currently exposes its ID through toDocument(). Retain only the
			// ID, not the document clone (which also contains decrypted entries).
			const id = vault.toDocument().id;
			const current = () => {
				if (!vault)
					throw new VaultWalletError(
						"SESSION_LOCKED",
						"Vault session is locked.",
					);
				return vault;
			};
			return {
				id,
				get: (entryId) => current().get(entryId),
				unlock: (reason, ttl) => current().unlock(reason, ttl),
				reveal: (entryId, reason) => current().reveal(entryId, reason),
				lock: () => {
					try {
						vault?.lock();
					} finally {
						vault = undefined;
					}
				},
			};
		} catch {
			try {
				vault?.lock();
			} catch {
				/* Preserve the sanitized unlock error. */
			}
			vault = undefined;
			throw new VaultWalletError(
				"UNLOCK_FAILED",
				"Cannot unlock the selected Vault.",
			);
		}
	};
}

export interface VaultWalletDependencies {
	openVault: VaultWalletLoader;
	profileDerivationApi?: VaultProfileDerivationApi;
	/** Factory seam for synthetic tests; production retains initWallet's WPM. */
	initializeWallet?: (
		key: PrivateKey,
		selection: Readonly<VaultWalletSelection>,
		signal: AbortSignal,
	) => Promise<WalletInitResult>;
	now?: () => number;
}

export interface VaultWalletSession {
	readonly binding: Readonly<VaultWalletBinding>;
	readonly state: VaultWalletState;
	readonly expiresAt: number;
	readonly depositAddress: string;
	readonly wallet: WalletInterface;
	readonly ctx: WalletInitResult["ctx"];
	/** Revokes immediately; waits for already-started calls before disposal. */
	lock(): Promise<void>;
}

/**
 * Open one explicitly selected encrypted key for an SDK wallet, in memory.
 * This API is for a trusted local unlock controller, not an MCP registration.
 * The supplied binding stays pinned for all calls; switching opens a new
 * session after locking the old one. Invalid selections never fall back.
 * Lock revokes access and releases SDK resources; JavaScript cannot guarantee
 * secret-memory zeroization. A dedicated process can be terminated when that
 * stronger lifecycle boundary is required by the local controller.
 */
export async function openVaultWalletSession(
	selection: VaultWalletSelection,
	passphrase: string,
	dependencies: VaultWalletDependencies,
): Promise<VaultWalletSession> {
	const parsed = vaultWalletBindingSchema.safeParse(selection.binding);
	if (
		!parsed.success ||
		parsed.data.accountId !== selection.accountName ||
		!isAbsolute(selection.vaultPath) ||
		!accountNameSchema.safeParse(selection.accountName).success ||
		!["main", "test"].includes(selection.chain) ||
		!selection.reason.trim()
	) {
		throw new VaultWalletError(
			"INVALID_SELECTION",
			"Select a valid Vault entry and existing wallet account.",
		);
	}
	const ttl = selection.ttlSeconds ?? 300;
	if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 3600) {
		throw new VaultWalletError(
			"INVALID_TTL",
			"Vault wallet sessions must last 1–3600 seconds.",
		);
	}
	const binding = parsed.data;
	if (binding.derivation?.scheme === "brc157") {
		Object.freeze(binding.derivation.leaf.protocolID);
		Object.freeze(binding.derivation.leaf);
	}
	if (binding.derivation?.scheme === "brc42")
		Object.freeze(binding.derivation.protocolID);
	if (binding.derivation) Object.freeze(binding.derivation);
	Object.freeze(binding);
	if (
		(binding.keyUseContract === "brc157-leaf-v1" ||
			binding.keyUseContract === "yours-legacy-leaf-v1") &&
		!dependencies.profileDerivationApi
	)
		throw new VaultWalletError(
			"PROFILE_API_UNAVAILABLE",
			"The installed Vault profile derivation API is unavailable.",
		);
	const pinned = Object.freeze({ ...selection, binding, ttlSeconds: ttl });
	const now = dependencies.now ?? Date.now;
	const controller = new AbortController();
	let access: VaultWalletAccess | undefined;
	let initialized: WalletInitResult | undefined;
	let key: PrivateKey | undefined;
	let state: VaultWalletState = "ready";
	let expiresAt = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let closing: Promise<void> | undefined;
	const pending = new Set<Promise<unknown>>();

	const close = (reason: "locked" | "expired") => {
		if (closing) return closing;
		state = reason;
		controller.abort(
			new VaultWalletError(
				"SESSION_LOCKED",
				"Vault wallet session is no longer active.",
			),
		);
		clearTimeout(timer);
		try {
			access?.lock();
		} catch {
			/* The facade is revoked regardless. */
		}
		access = undefined;
		key = undefined;
		closing = (async () => {
			// A submitted transaction cannot be rolled back. Keep the result of
			// an already-started call observable; never replace it with another key.
			await Promise.allSettled([...pending]);
			const current = initialized;
			initialized = undefined;
			try {
				await current?.destroy();
			} catch {
				throw new VaultWalletError(
					"CLEANUP_FAILED",
					"Wallet session closed, but resource cleanup failed.",
				);
			}
		})();
		return closing;
	};
	const assertActive = () => {
		if (state === "ready" && now() >= expiresAt) {
			void close("expired").catch(() => {});
		}
		if (state !== "ready") {
			throw new VaultWalletError(
				state === "expired" ? "SESSION_EXPIRED" : "SESSION_LOCKED",
				"Unlock the selected Vault wallet again before using it.",
			);
		}
	};
	try {
		try {
			access = await dependencies.openVault(pinned.vaultPath, passphrase);
		} catch {
			throw new VaultWalletError(
				"UNLOCK_FAILED",
				"Cannot unlock the selected Vault.",
			);
		}
		if (access.id !== binding.vaultId) {
			throw new VaultWalletError(
				"VAULT_MISMATCH",
				"The selected Vault does not match this binding.",
			);
		}
		let entry: ReturnType<VaultWalletAccess["get"]>;
		try {
			entry = access.get(binding.entryId);
		} catch {
			throw new VaultWalletError(
				"ENTRY_UNAVAILABLE",
				"The selected Vault entry is unavailable.",
			);
		}
		if (
			(binding.keyUseContract === "direct-v1" ||
				binding.keyUseContract === "brc42-leaf-v1") &&
			entry.kind !== "private" &&
			entry.kind !== "wif"
		) {
			throw new VaultWalletError(
				"UNSUPPORTED_ENTRY",
				"This wallet requires an explicitly selected private-key or WIF entry.",
			);
		}
		if (
			binding.keyUseContract === "direct-v1" &&
			entry.publicKey !== undefined &&
			entry.publicKey.toLowerCase() !== binding.expectedPublicKey.toLowerCase()
		) {
			throw new VaultWalletError(
				"IDENTITY_MISMATCH",
				"The selected entry does not match the approved wallet identity.",
			);
		}
		expiresAt = now() + ttl * 1000;
		access.unlock(pinned.reason, ttl);
		timer = setTimeout(
			() => {
				void close("expired").catch(() => {});
			},
			Math.max(0, expiresAt - now()),
		);
		timer.unref?.();
		try {
			if (
				binding.keyUseContract === "brc157-leaf-v1" ||
				binding.keyUseContract === "yours-legacy-leaf-v1"
			) {
				const profileApi = dependencies.profileDerivationApi;
				if (!profileApi) throw new Error("Profile API unavailable");
				const profileAccess = access;
				key = resolveVaultProfileBindingKey(
					{
						id: access.id,
						assertActive,
						get: (id) => profileAccess.get(id),
						reveal: (id, reason) => profileAccess.reveal(id, reason),
					},
					{
						keyUseContract: binding.keyUseContract,
						key: {
							vaultId: binding.vaultId,
							entryId: binding.entryId,
							expectedPublicKey: binding.expectedPublicKey,
							derivation: binding.derivation,
						},
					},
					pinned.reason,
					profileApi,
				);
			} else {
				const value = access.reveal(binding.entryId, pinned.reason);
				key =
					entry.kind === "private"
						? PrivateKey.fromHex(value)
						: PrivateKey.fromWif(value);
				if (binding.derivation?.scheme === "brc42") {
					const { protocolID, keyID, counterparty } = binding.derivation;
					key = new KeyDeriver(key).derivePrivateKey(
						protocolID,
						keyID,
						counterparty,
					);
				}
			}
		} catch {
			throw new VaultWalletError(
				"KEY_UNAVAILABLE",
				"The selected key is invalid or Vault reveal is disabled.",
			);
		}
		if (
			key.toPublicKey().toString().toLowerCase() !==
			binding.expectedPublicKey.toLowerCase()
		) {
			throw new VaultWalletError(
				"IDENTITY_MISMATCH",
				"The selected key does not match the approved wallet identity.",
			);
		}
		assertActive();
		const initialize =
			dependencies.initializeWallet ??
			((privateKey, selected, signal) =>
				initWallet(privateKey, selected.chain, {
					...walletStorageForKey(
						selected.accountName,
						selected.binding.expectedPublicKey,
					),
					trackActive: false,
					sessionSignal: signal,
				}));
		initialized = await initialize(key, pinned, controller.signal);
		key = undefined;
		// An initializer may finish after the timer has already revoked the
		// session. Its newly returned resources still need disposal.
		if (controller.signal.aborted) {
			const late = initialized;
			initialized = undefined;
			await late.destroy().catch(() => {});
			throw new VaultWalletError(
				"SESSION_EXPIRED",
				"Unlock the selected Vault wallet again before using it.",
			);
		}
		// Drop the decrypted Vault once the selected SDK key has been handed
		// off. Session revocation below is owned here, not by Vault.lock().
		access.lock();
		access = undefined;
		assertActive();

		const invoke = <K extends keyof WalletInterface>(
			name: K,
		): WalletInterface[K] => {
			const method = (...args: Parameters<WalletInterface[K]>) => {
				try {
					assertActive();
				} catch (error) {
					return Promise.reject(error);
				}
				const current = initialized;
				if (!current)
					return Promise.reject(
						new VaultWalletError("SESSION_LOCKED", "Wallet session is closed."),
					);
				const call = Promise.resolve().then(() => {
					assertActive();
					return Reflect.apply(current.wallet[name], current.wallet, args);
				});
				pending.add(call);
				void call.then(
					() => pending.delete(call),
					() => pending.delete(call),
				);
				return call;
			};
			// Every method retains its SDK arguments/result; only invocation is
			// intercepted. The explicit object below exposes no WPM/key fields.
			return method as WalletInterface[K];
		};
		const wallet: WalletInterface = Object.freeze({
			getPublicKey: invoke("getPublicKey"),
			revealCounterpartyKeyLinkage: invoke("revealCounterpartyKeyLinkage"),
			revealSpecificKeyLinkage: invoke("revealSpecificKeyLinkage"),
			encrypt: invoke("encrypt"),
			decrypt: invoke("decrypt"),
			createHmac: invoke("createHmac"),
			verifyHmac: invoke("verifyHmac"),
			createSignature: invoke("createSignature"),
			verifySignature: invoke("verifySignature"),
			createAction: invoke("createAction"),
			signAction: invoke("signAction"),
			abortAction: invoke("abortAction"),
			listActions: invoke("listActions"),
			internalizeAction: invoke("internalizeAction"),
			listOutputs: invoke("listOutputs"),
			relinquishOutput: invoke("relinquishOutput"),
			acquireCertificate: invoke("acquireCertificate"),
			listCertificates: invoke("listCertificates"),
			proveCertificate: invoke("proveCertificate"),
			relinquishCertificate: invoke("relinquishCertificate"),
			discoverByIdentityKey: invoke("discoverByIdentityKey"),
			discoverByAttributes: invoke("discoverByAttributes"),
			isAuthenticated: invoke("isAuthenticated"),
			waitForAuthentication: invoke("waitForAuthentication"),
			getHeight: invoke("getHeight"),
			getHeaderForHeight: invoke("getHeaderForHeight"),
			getNetwork: invoke("getNetwork"),
			getVersion: invoke("getVersion"),
		});
		const ctx = Object.freeze({ ...initialized.ctx, wallet });
		const depositAddress = initialized.depositAddress;
		return Object.freeze({
			binding,
			get state() {
				if (state === "ready" && now() >= expiresAt)
					void close("expired").catch(() => {});
				return state;
			},
			expiresAt,
			depositAddress,
			wallet,
			ctx,
			lock: () => close("locked"),
		});
	} catch (error) {
		await close("locked").catch(() => {});
		if (error instanceof VaultWalletError) throw error;
		throw new VaultWalletError(
			"INITIALIZATION_FAILED",
			"Cannot initialize the selected Vault wallet.",
		);
	}
}
