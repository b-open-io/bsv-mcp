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
	type DecryptedBackup,
	type OneSatBackup,
	decryptBackup,
	encryptBackup,
} from "bitcoin-backup";
import { promptForPassphraseWithFallback } from "./passphrasePrompt";

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
	autoMigrate?: boolean;
	keepLegacy?: boolean;
}

/**
 * Secure key manager with encryption support
 *
 * Features:
 * - Encrypted key storage using bitcoin-backup
 * - Backward compatibility with legacy JSON format
 * - Automatic migration from unencrypted to encrypted
 * - Backup management
 */
export class SecureKeyManager {
	private readonly keyDir: string;
	private readonly legacyFile: string;
	private readonly encryptedFile: string;
	private readonly backupFile: string;
	private readonly config: KeyManagerConfig;

	constructor(config: KeyManagerConfig = {}) {
		this.config = config;
		this.keyDir = config.keyDir || path.join(os.homedir(), ".bsv-mcp");
		this.legacyFile = path.join(this.keyDir, "keys.json");
		this.encryptedFile = path.join(this.keyDir, "keys.bep");
		this.backupFile = path.join(this.keyDir, "keys.bep.backup");
	}

	/**
	 * Check if user has legacy passphrase environment variable set
	 */
	hasLegacyPassphrase(): boolean {
		return !!process.env.BSV_MCP_PASSPHRASE;
	}

	/**
	 * Load keys with automatic format detection and migration
	 */
	async loadKeys(): Promise<{
		keys: KeyStore;
		source: "encrypted" | "legacy" | "none";
	}> {
		// Warn about legacy passphrase usage
		if (this.hasLegacyPassphrase()) {
			console.warn(
				"\n⚠️  WARNING: BSV_MCP_PASSPHRASE environment variable is deprecated!\n" +
					"   This is insecure as it stores your passphrase in plain text.\n" +
					"   Please remove it from your environment.\n" +
					"   The system will now prompt for passphrases when needed.\n",
			);
		}

		// Try encrypted format first
		if (this.hasEncryptedBackup()) {
			try {
				// Prompt for passphrase to decrypt
				const passphrase = await promptForPassphraseWithFallback(
					"Enter passphrase to decrypt your wallet keys",
				);
				const keys = await this.loadEncryptedKeys(passphrase);
				return { keys, source: "encrypted" };
			} catch (error) {
				// If user cancels or timeout, try legacy format
				if (
					error instanceof Error &&
					(error.message.includes("cancelled") ||
						error.message.includes("timeout"))
				) {
					console.log(
						"⚠️ Passphrase prompt cancelled, checking for legacy keys...",
					);
				} else {
					console.error("❌ Failed to decrypt keys.bep:", error);
				}
			}
		}

		// Try legacy format
		if (this.hasLegacyKeys()) {
			const keys = this.loadLegacyKeys();

			// Offer to migrate if auto-migrate is enabled
			if (this.config.autoMigrate !== false) {
				console.log(
					"\n[Clipboard] Found unencrypted keys. Would you like to encrypt them?",
				);
				console.log(
					"   (You can skip this by pressing Ctrl+C in the browser)\n",
				);

				try {
					const passphrase = await promptForPassphraseWithFallback(
						"Create a passphrase to encrypt your wallet keys (recommended)",
						{ isNewPassphrase: true },
					);

					console.log("🔄 Migrating keys to encrypted format...");
					await this.saveEncryptedKeys(keys, passphrase);
					console.log("✅ Keys migrated to encrypted format");

					// Remove legacy file unless configured to keep
					if (!this.config.keepLegacy) {
						this.removeLegacyKeys();
					}

					return { keys, source: "encrypted" };
				} catch (error) {
					console.log("ℹ️  Continuing with unencrypted keys...");
				}
			}

			return { keys, source: "legacy" };
		}

		// No keys found
		return { keys: {}, source: "none" };
	}

	/**
	 * Save keys in the appropriate format
	 */
	async saveKeys(keys: KeyStore, forceUnencrypted = false): Promise<void> {
		// If forcing unencrypted (for initial generation), save as legacy
		if (forceUnencrypted) {
			this.saveLegacyKeys(keys);
			console.log(
				"💾 Saved unencrypted keys (you can encrypt them on next run)",
			);
			return;
		}

		// If we already have encrypted keys, prompt for passphrase
		if (this.hasEncryptedBackup()) {
			try {
				const passphrase = await promptForPassphraseWithFallback(
					"Enter passphrase to update your encrypted wallet",
				);
				await this.saveEncryptedKeys(keys, passphrase);
				return;
			} catch (error) {
				console.error("⚠️ Failed to encrypt keys:", error);
				throw error;
			}
		}

		// For new keys, ask if user wants to encrypt
		try {
			console.log("\n[Lock] Would you like to encrypt your new wallet keys?");
			console.log("   (Recommended for security)\n");

			const passphrase = await promptForPassphraseWithFallback(
				"Create a passphrase to encrypt your wallet keys",
				{ isNewPassphrase: true },
			);
			await this.saveEncryptedKeys(keys, passphrase);
		} catch (error) {
			// User cancelled or error - save unencrypted
			console.log("ℹ️  Saving keys unencrypted (you can encrypt them later)");
			this.saveLegacyKeys(keys);
		}
	}

	/**
	 * Load keys from legacy JSON format
	 */
	private loadLegacyKeys(): KeyStore {
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
	private saveLegacyKeys(keys: KeyStore): void {
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
	private async loadEncryptedKeys(passphrase: string): Promise<KeyStore> {
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
				} catch (e) {
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
				payPk: undefined, // BapMasterBackup doesn't include payment key
				identityPk: undefined, // BapMasterBackup doesn't include identity key
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

		// If we have xprv, we need to store it separately in the legacy format for now
		// since OneSatBackup doesn't support xprv
		if (keys.xprv) {
			// Store xprv in the legacy JSON alongside encrypted keys
			// This is a temporary solution until we have a better format
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
	 * Remove legacy keys file
	 */
	private removeLegacyKeys(): void {
		try {
			fs.unlinkSync(this.legacyFile);
			console.log("🗑️ Removed legacy unencrypted keys file");
		} catch (error) {
			console.error("Failed to remove legacy keys:", error);
		}
	}

	/**
	 * Get status of key storage
	 */
	getStatus(): {
		hasEncrypted: boolean;
		hasLegacy: boolean;
		hasLegacyPassphrase: boolean;
		isSecure: boolean;
	} {
		const hasEncrypted = this.hasEncryptedBackup();
		const hasLegacy = this.hasLegacyKeys();
		const hasLegacyPassphrase = this.hasLegacyPassphrase();

		return {
			hasEncrypted,
			hasLegacy,
			hasLegacyPassphrase,
			isSecure: hasEncrypted && !hasLegacy,
		};
	}
}

/**
 * Default key manager instance
 */
export const keyManager = new SecureKeyManager({
	autoMigrate: process.env.BSV_MCP_AUTO_MIGRATE === "true",
	keepLegacy: process.env.BSV_MCP_KEEP_LEGACY === "true",
});

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
			console.log("✅ Using PRIVATE_KEY_WIF from environment");
			return {
				payPk,
				source: "env",
			};
		} catch (error) {
			console.error("⚠️ Invalid PRIVATE_KEY_WIF format");
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
