/**
 * Secure key management using bitcoin-backup
 * Provides encrypted storage for BSV MCP keys with backward compatibility
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrivateKey } from "@bsv/sdk";
import {
	type BapMasterBackup,
	decryptBackup,
	encryptBackup,
	type OneSatBackup,
} from "bitcoin-backup";

/**
 * Key storage interface
 */
export interface KeyStore {
	payPk?: PrivateKey;
	identityPk?: PrivateKey;
	xprv?: string;
}

/**
 * Configuration for key manager
 */
export interface KeyManagerConfig {
	keyDir?: string;
}

/**
 * Options for saveKeys
 */
export interface SaveKeysOptions {
	passphrase?: string;
	forceUnencrypted?: boolean;
}

/**
 * Secure key manager with encryption support
 *
 * Features:
 * - Encrypted key storage using bitcoin-backup (opt-in, requires explicit passphrase)
 * - Backward compatibility with legacy JSON format
 * - Never auto-prompts for passphrases
 */
export class SecureKeyManager {
	private readonly keyDir: string;
	private readonly legacyFile: string;
	private readonly encryptedFile: string;
	private readonly backupFile: string;

	constructor(config: KeyManagerConfig = {}) {
		this.keyDir = config.keyDir || path.join(os.homedir(), ".bsv-mcp");
		this.legacyFile = path.join(this.keyDir, "keys.json");
		this.encryptedFile = path.join(this.keyDir, "keys.bep");
		this.backupFile = path.join(this.keyDir, "keys.bep.backup");
	}

	/**
	 * Load keys without prompting for a passphrase.
	 *
	 * - If passphrase is provided AND keys.bep exists → decrypt with it
	 * - If no passphrase AND keys.bep exists → log and fall through to legacy
	 * - If keys.json exists → load silently
	 * - Otherwise → return empty KeyStore
	 */
	async loadKeys(passphrase?: string): Promise<{
		keys: KeyStore;
		source: "encrypted" | "legacy" | "none";
	}> {
		// Try encrypted format if passphrase provided
		if (passphrase && this.hasEncryptedBackup()) {
			const keys = await this.loadEncryptedKeys(passphrase);
			return { keys, source: "encrypted" };
		}

		// Encrypted file exists but no passphrase — skip silently with a log
		if (this.hasEncryptedBackup() && !passphrase) {
			console.error(
				"Encrypted keys found (keys.bep). Provide a passphrase via loadKeys(passphrase) to decrypt, or use keys.json / PRIVATE_KEY_WIF instead.",
			);
		}

		// Try legacy format
		if (this.hasLegacyKeys()) {
			const keys = this.loadLegacyKeys();
			return { keys, source: "legacy" };
		}

		// No keys found
		return { keys: {}, source: "none" };
	}

	/**
	 * Save keys.
	 *
	 * - If options.passphrase provided → encrypt and save to keys.bep
	 * - Otherwise → save plaintext to keys.json
	 */
	async saveKeys(keys: KeyStore, options: SaveKeysOptions = {}): Promise<void> {
		if (options.passphrase) {
			await this.saveEncryptedKeys(keys, options.passphrase);
			return;
		}

		this.saveLegacyKeys(keys);
	}

	/**
	 * Load keys from legacy JSON format
	 */
	loadLegacyKeys(): KeyStore {
		try {
			const content = fs.readFileSync(this.legacyFile, "utf8");
			const data = JSON.parse(content);

			return {
				payPk: data.payPk ? PrivateKey.fromWif(data.payPk) : undefined,
				identityPk: data.identityPk
					? PrivateKey.fromWif(data.identityPk)
					: undefined,
				xprv: data.xprv,
			};
		} catch (error) {
			throw new Error(`Failed to load legacy keys: ${error}`);
		}
	}

	/**
	 * Save keys in legacy JSON format
	 */
	saveLegacyKeys(keys: KeyStore): void {
		const data = {
			payPk: keys.payPk?.toWif(),
			identityPk: keys.identityPk?.toWif(),
			xprv: keys.xprv,
		};

		fs.mkdirSync(this.keyDir, { recursive: true, mode: 0o700 });
		fs.writeFileSync(this.legacyFile, JSON.stringify(data, null, 2), {
			mode: 0o600,
		});
	}

	/**
	 * Load keys from encrypted backup
	 */
	async loadEncryptedKeys(passphrase: string): Promise<KeyStore> {
		const encrypted = fs.readFileSync(this.encryptedFile, "utf8");
		const decrypted = await decryptBackup(encrypted, passphrase);

		// Check if it's a OneSatBackup (our format)
		if ("payPk" in decrypted && "identityPk" in decrypted) {
			const backup = decrypted as OneSatBackup;
			// Also check for xprv in legacy file if it exists
			let xprv: string | undefined;
			if (fs.existsSync(this.legacyFile)) {
				try {
					const legacyData = JSON.parse(
						fs.readFileSync(this.legacyFile, "utf8"),
					);
					xprv = legacyData.xprv;
				} catch (_e) {
					// Ignore legacy file errors
				}
			}
			return {
				payPk: backup.payPk ? PrivateKey.fromWif(backup.payPk) : undefined,
				identityPk: backup.identityPk
					? PrivateKey.fromWif(backup.identityPk)
					: undefined,
				xprv,
			};
		}

		// Check if it's a BapMasterBackup (for xprv)
		if ("xprv" in decrypted) {
			const backup = decrypted as BapMasterBackup;
			return {
				payPk: undefined,
				identityPk: undefined,
				xprv: backup.xprv,
			};
		}

		throw new Error("Unknown backup format");
	}

	/**
	 * Save keys in encrypted format
	 */
	async saveEncryptedKeys(keys: KeyStore, passphrase: string): Promise<void> {
		// We use OneSatBackup format which includes all our keys
		const data: OneSatBackup = {
			payPk: keys.payPk?.toWif() || "",
			identityPk: keys.identityPk?.toWif() || "",
			ordPk: "", // We don't use ordinals key, but it's required by the type
			label: "BSV MCP Keys",
			createdAt: new Date().toISOString(),
		};

		// If we have xprv, store it separately in the legacy JSON alongside encrypted keys
		// since OneSatBackup doesn't support xprv
		if (keys.xprv) {
			const legacyData = {
				xprv: keys.xprv,
			};
			fs.mkdirSync(this.keyDir, { recursive: true, mode: 0o700 });
			fs.writeFileSync(this.legacyFile, JSON.stringify(legacyData, null, 2), {
				mode: 0o600,
			});
		}

		const encrypted = await encryptBackup(data, passphrase);

		// Create backup of existing file
		if (fs.existsSync(this.encryptedFile)) {
			fs.copyFileSync(this.encryptedFile, this.backupFile);
		}

		fs.mkdirSync(this.keyDir, { recursive: true, mode: 0o700 });
		fs.writeFileSync(this.encryptedFile, encrypted, { mode: 0o600 });
	}

	/**
	 * Check if encrypted backup exists
	 */
	hasEncryptedBackup(): boolean {
		return fs.existsSync(this.encryptedFile);
	}

	/**
	 * Check if legacy keys exist
	 */
	hasLegacyKeys(): boolean {
		return fs.existsSync(this.legacyFile);
	}

	/**
	 * Get status of key storage
	 */
	getStatus(): {
		hasEncrypted: boolean;
		hasLegacy: boolean;
		isSecure: boolean;
	} {
		const hasEncrypted = this.hasEncryptedBackup();
		const hasLegacy = this.hasLegacyKeys();

		return {
			hasEncrypted,
			hasLegacy,
			isSecure: hasEncrypted && !hasLegacy,
		};
	}
}

/**
 * Default key manager instance
 */
export const keyManager = new SecureKeyManager();

/**
 * Initialize keys with secure storage support
 *
 * This is a wrapper around the key manager for easier migration
 * from the existing initializeKeys function
 */
export async function initializeSecureKeys(): Promise<{
	payPk?: PrivateKey;
	identityPk?: PrivateKey;
	xprv?: string;
	source: "env" | "encrypted" | "legacy" | "generated" | "none";
}> {
	// Check environment first (maintains compatibility)
	const privateKeyWifEnv = process.env.PRIVATE_KEY_WIF;
	if (privateKeyWifEnv) {
		try {
			const payPk = PrivateKey.fromWif(privateKeyWifEnv);
			console.error("Using PRIVATE_KEY_WIF from environment");
			return {
				payPk,
				source: "env",
			};
		} catch (_error) {
			console.error("Invalid PRIVATE_KEY_WIF format");
		}
	}

	// Try loading from secure storage
	try {
		const { keys, source } = await keyManager.loadKeys();
		if (keys.payPk || keys.xprv) {
			const sourceMap = {
				encrypted: "encrypted" as const,
				legacy: "legacy" as const,
				none: "none" as const,
			};
			return { ...keys, source: sourceMap[source] || "none" };
		}
	} catch (error) {
		console.error("Failed to load keys:", error);
	}

	return { source: "none" };
}
