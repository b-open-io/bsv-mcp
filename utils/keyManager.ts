import fs from "node:fs";
import path from "node:path";
import { HD, PrivateKey } from "@bsv/sdk";
import { decryptBackup, encryptBackup, type WifBackup } from "bitcoin-backup";
import {
	accountDir,
	accountName,
	regularPath,
	secureDirectory,
} from "./accounts";

export interface KeyStore {
	payPk?: PrivateKey;
	identityPk?: PrivateKey;
	xprv?: string;
}
export interface KeyManagerConfig {
	keyDir?: string;
}
export interface SaveKeysOptions {
	passphrase?: string;
}
export class MissingWalletKeysError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MissingWalletKeysError";
	}
}
export function isMissingWalletKeysError(
	error: unknown,
): error is MissingWalletKeysError {
	return error instanceof MissingWalletKeysError;
}
export class LegacyWalletMigrationRequiredError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LegacyWalletMigrationRequiredError";
	}
}
export function isLegacyWalletMigrationRequiredError(
	error: unknown,
): error is LegacyWalletMigrationRequiredError {
	return error instanceof LegacyWalletMigrationRequiredError;
}
export class SecureKeyManager {
	readonly keyDir: string;
	constructor(config: KeyManagerConfig = {}) {
		this.keyDir = config.keyDir ?? accountDir();
	}
	get encryptedFile() {
		return path.join(this.keyDir, "keys.bep");
	}
	get legacyFile() {
		return path.join(this.keyDir, "keys.json");
	}
	async loadKeys(
		passphrase = process.env.BSV_MCP_PASSWORD,
	): Promise<{ keys: KeyStore; source: "encrypted" | "none" }> {
		regularPath(this.keyDir, true);
		if (this.hasEncryptedBackup()) {
			if (!passphrase)
				throw new Error(
					`Password required for ${this.encryptedFile}. Set BSV_MCP_PASSWORD or use bsv-mcp signer-serve in a terminal.`,
				);
			return {
				keys: await this.loadEncryptedKeys(passphrase),
				source: "encrypted",
			};
		}
		if (this.hasLegacyKeys())
			throw new LegacyWalletMigrationRequiredError(
				`Legacy plaintext keys require migration. Run bsv-mcp wallet_migrate --account ${accountName()}.`,
			);
		return { keys: {}, source: "none" };
	}
	/** Legacy files are read only by the explicit migration command. Never fall back at startup. */
	loadLegacyKeys(): KeyStore {
		regularPath(this.legacyFile);
		try {
			return decodeKeys(JSON.parse(fs.readFileSync(this.legacyFile, "utf8")));
		} catch {
			throw new Error("Cannot read legacy keys; source file was not changed");
		}
	}
	async loadEncryptedKeys(passphrase: string): Promise<KeyStore> {
		regularPath(this.encryptedFile);
		try {
			return decodeEncryptedKeys(
				fs.readFileSync(this.encryptedFile, "utf8"),
				passphrase,
			);
		} catch {
			throw new Error(
				"Cannot unlock account; check the password and encrypted backup",
			);
		}
	}
	async saveKeys(keys: KeyStore, options: SaveKeysOptions = {}) {
		const password = options.passphrase ?? process.env.BSV_MCP_PASSWORD;
		if (!password || password.length < 8)
			throw new Error(
				"An encryption password of at least 8 characters is required; plaintext saving is disabled",
			);
		if (!keys.payPk) throw new Error("A payment key is required");
		// WifBackup remains CLI-compatible; optional legacy identity material stays inside encryption.
		const data: WifBackup & { bsvMcp: { identityPk?: string; xprv?: string } } =
			{
				wif: keys.payPk.toWif(),
				bsvMcp: { identityPk: keys.identityPk?.toWif(), xprv: keys.xprv },
				label: "BSV MCP account",
				createdAt: new Date().toISOString(),
			};
		const encrypted = await encryptBackup(data, password);
		const verified = decodeKeys(await decryptBackup(encrypted, password));
		if (
			verified.payPk?.toWif() !== data.wif ||
			verified.xprv !== keys.xprv ||
			verified.identityPk?.toWif() !== data.bsvMcp.identityPk
		)
			throw new Error("Encrypted backup verification failed");
		secureDirectory(this.keyDir);
		regularPath(this.encryptedFile);
		const temp = path.join(this.keyDir, `.keys-${crypto.randomUUID()}.bep`);
		fs.writeFileSync(temp, encrypted, { mode: 0o600, flag: "wx" });
		fs.renameSync(temp, this.encryptedFile);
	}
	async saveEncryptedKeys(keys: KeyStore, passphrase: string) {
		await this.saveKeys(keys, { passphrase });
	}
	hasEncryptedBackup() {
		regularPath(this.encryptedFile);
		return fs.existsSync(this.encryptedFile);
	}
	hasLegacyKeys() {
		regularPath(this.legacyFile);
		return fs.existsSync(this.legacyFile);
	}
	getStatus() {
		const hasEncrypted = this.hasEncryptedBackup();
		const hasLegacy = this.hasLegacyKeys();
		return { hasEncrypted, hasLegacy, isSecure: hasEncrypted && !hasLegacy };
	}
}
function decodeKeys(value: unknown): KeyStore {
	const raw = value as Record<string, unknown>;
	const data = {
		...raw,
		...(raw.bsvMcp as Record<string, unknown> | undefined),
	};
	const wif = data.wif ?? data.payPk;
	if (typeof wif !== "string" || !wif)
		throw new Error("Backup has no payment key");
	if (
		data.xprv !== undefined &&
		(typeof data.xprv !== "string" || !HD.fromString(data.xprv).privKey)
	)
		throw new Error("Invalid identity backup");
	return {
		payPk: PrivateKey.fromWif(wif),
		identityPk: data.identityPk
			? PrivateKey.fromWif(String(data.identityPk))
			: undefined,
		xprv: data.xprv as string | undefined,
	};
}
export const keyManager = new SecureKeyManager();
export async function initializeSecureKeys(
	manager = new SecureKeyManager(),
	env: Record<string, string | undefined> = process.env,
) {
	if (env.PRIVATE_KEY_WIF !== undefined) {
		try {
			return {
				payPk: PrivateKey.fromWif(env.PRIVATE_KEY_WIF),
				identityPk: env.IDENTITY_KEY_WIF
					? PrivateKey.fromWif(env.IDENTITY_KEY_WIF)
					: undefined,
				xprv: undefined,
				source: "env" as const,
			};
		} catch {
			throw new Error(
				"Invalid PRIVATE_KEY_WIF or IDENTITY_KEY_WIF; no fallback wallet was loaded",
			);
		}
	}
	const result = await manager.loadKeys(env.BSV_MCP_PASSWORD);
	if (!result.keys.payPk) {
		if (result.source === "none")
			throw new MissingWalletKeysError(
				`No key found at ${manager.encryptedFile}. Run bsv-mcp init --account ${accountName()} in a terminal, or configure BRC100_WALLET_URL. For public reads only, set DISABLE_WALLET_TOOLS=true.`,
			);
		throw new Error(
			`No key found at ${manager.encryptedFile}. Run bsv-mcp init --account ${accountName()} in a terminal, or configure BRC100_WALLET_URL. For public reads only, set DISABLE_WALLET_TOOLS=true.`,
		);
	}
	return { ...result.keys, source: result.source };
}

export async function decodeEncryptedKeys(encrypted: string, password: string) {
	try {
		return decodeKeys(await decryptBackup(encrypted, password));
	} catch {
		throw new Error("Cannot unlock backup; check the password and format");
	}
}
