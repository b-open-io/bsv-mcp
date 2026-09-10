import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
	chmodSync,
	existsSync,
	constants as fsConstants,
	lstatSync,
	readFileSync,
} from "node:fs";
import { copyFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { P1SAT_PROTOCOL } from "@1sat/actions";
import { HD, PrivateKey, ProtoWallet, PublicKey } from "@bsv/sdk";
import {
	type AccountConfig,
	accountNameSchema,
	embeddedVaultBindingSchema,
	newAccountConfig,
	readAccount,
	readAccountRevision,
	regularPath,
	type EmbeddedVaultBinding as StoredBinding,
	secureDirectory,
	writeAccount,
} from "./accounts";
import {
	createEmbeddedVaultIo,
	type EmbeddedVaultReceipt,
} from "./embeddedVaultIo";
import { decodeEncryptedKeys, SecureKeyManager } from "./keyManager";
import { readMcpClientEnvValue } from "./mcpClientKeySources";
import { inspectMigration, type MigrationSource } from "./vaultMigration";

export const IMPORT_CONFIRMATION = "IMPORT_WALLET_CONFIRMED" as const;
const MAX_BACKUP_BYTES = 1024 * 1024;
const DB_NAME_PATTERN = /^wallet(-(main|test))?\.db$/;

export interface EmbeddedImportBackendOptions {
	vaultPath: string;
	accountsDirectory?: string;
	home?: string;
	chain?: "main" | "test";
	loadModule?: () => Promise<unknown>;
}

export interface EmbeddedImportInput {
	source: MigrationSource;
	password: string;
	passwordConfirmation?: string;
	sourcePassphrase?: string;
	confirmation: typeof IMPORT_CONFIRMATION;
}

export interface EmbeddedImportBackupInput {
	backupText: string;
	backupName: string;
	accountName: string;
	sourcePassphrase?: string;
	destinationPassphrase: string;
	passwordConfirmation?: string;
	confirmation: typeof IMPORT_CONFIRMATION;
}

export interface EmbeddedImportResult {
	accountName: string;
	address: string;
	binding: StoredBinding;
}

export interface EmbeddedImportBackend {
	import(input: EmbeddedImportInput): Promise<EmbeddedImportResult>;
	importBackup(input: EmbeddedImportBackupInput): Promise<EmbeddedImportResult>;
}

export class EmbeddedImportError extends Error {
	readonly code: string;
	constructor(code: string, message: string) {
		super(message);
		this.name = "EmbeddedImportError";
		this.code = code;
	}
}

const failure = (code: string, message: string): EmbeddedImportError =>
	new EmbeddedImportError(code, message);

// Fixed sanitized messages. Never include paths, SDK errors, or key material.
const MESSAGES = {
	INVALID_OPTIONS: "The embedded import destination is not configured.",
	INVALID_INPUT: "The embedded import request is invalid.",
	CONFIRMATION_REQUIRED:
		"Explicit wallet import confirmation is required before any key is read.",
	UNKNOWN_SOURCE:
		"The selected import source was not found in the server inventory.",
	SOURCE_UNAVAILABLE: "The selected import source has no readable wallet keys.",
	CREDENTIALS_REQUIRED:
		"The source passphrase or destination password is missing or too short.",
	UNLOCK_FAILED:
		"Cannot unlock the import source; check the passphrase and try again.",
	INVALID_KEYS: "The imported backup does not contain valid wallet keys.",
	ADDRESS_MISMATCH:
		"The imported keys do not match the configured account address.",
	CHAIN_MISMATCH:
		"The requested network conflicts with the configured account network.",
	CONFIG_CONFLICT:
		"The account configuration changed during import; no overwrite was made.",
	DB_CONFLICT:
		"A destination wallet database already exists with different content.",
	DB_UNSAFE:
		"The source wallet database cannot be safely copied in its current state.",
	VAULT_FAILED:
		"The embedded vault import did not complete; no account was changed.",
	RECONCILIATION_NEEDED:
		"The vault import was written but the account configuration was not updated; reconcile before retrying.",
	BACKUP_INVALID: "The uploaded backup is not a supported wallet backup.",
	BACKUP_TOO_LARGE: "The uploaded backup exceeds the supported size.",
	ACCOUNT_INVALID: "The requested account name is invalid.",
	MATCHING_KEYS_REQUIRED:
		"The configured account needs a matching-key backup proving its address before keys can be attached.",
} as const;

interface OriginalKeys {
	payWif: string;
	payPub: string;
	identityWif?: string;
	identityPub?: string;
	xprv?: string;
	expectedXpub?: string;
}

interface TrustedSelection {
	entry: MigrationSource;
	sourceDir?: string;
	destName: string;
	destDir: string;
	destRoot: string;
	home: string;
	vaultPath: string;
}

function digest(data: Uint8Array | string): string {
	return createHash("sha256").update(data).digest("hex");
}

function assertConfirmation(value: unknown): void {
	if (value !== IMPORT_CONFIRMATION)
		throw failure("CONFIRMATION_REQUIRED", MESSAGES.CONFIRMATION_REQUIRED);
}

function resolveTrustedHome(home: string | undefined): string {
	const candidate = home ?? homedir();
	if (typeof candidate !== "string" || !isAbsolute(candidate))
		throw failure("INVALID_OPTIONS", MESSAGES.INVALID_OPTIONS);
	return candidate;
}

function resolveVaultPath(vaultPath: unknown): string {
	if (typeof vaultPath !== "string" || !isAbsolute(vaultPath))
		throw failure("INVALID_OPTIONS", MESSAGES.INVALID_OPTIONS);
	return vaultPath;
}

function resolveDestRoot(
	accountsDirectory: string | undefined,
	home: string,
): string {
	const candidate = accountsDirectory ?? join(home, ".bsv-mcp", "accounts");
	if (typeof candidate !== "string" || !isAbsolute(candidate))
		throw failure("INVALID_OPTIONS", MESSAGES.INVALID_OPTIONS);
	return candidate;
}

function rejectUnsafePath(candidate: string): void {
	if (
		typeof candidate !== "string" ||
		candidate.length === 0 ||
		candidate.includes("\0")
	)
		throw failure("INVALID_INPUT", MESSAGES.INVALID_INPUT);
	try {
		regularPath(candidate);
	} catch {
		throw failure("INVALID_INPUT", MESSAGES.INVALID_INPUT);
	}
}

function rejectUnsafeDir(candidate: string): void {
	if (
		typeof candidate !== "string" ||
		candidate.length === 0 ||
		candidate.includes("\0")
	)
		throw failure("INVALID_INPUT", MESSAGES.INVALID_INPUT);
	try {
		regularPath(candidate, true);
	} catch {
		throw failure("INVALID_INPUT", MESSAGES.INVALID_INPUT);
	}
}

function selectTrustedSource(
	source: MigrationSource,
	home: string,
	destRoot: string,
	vaultPath: string,
): TrustedSelection {
	const account =
		typeof source?.account === "string" ? source.account : undefined;
	const location = source?.location;
	if (
		account === undefined ||
		accountNameSchema.safeParse(account).success !== true ||
		(location !== "account" &&
			location !== "legacy-root" &&
			location !== "custom" &&
			location !== "environment" &&
			location !== "mcp-client")
	)
		throw failure("INVALID_INPUT", MESSAGES.INVALID_INPUT);
	let inventory: ReturnType<typeof inspectMigration>;
	try {
		inventory = inspectMigration({
			home,
			env: { ...process.env, VAULT_PATH: vaultPath },
		});
	} catch {
		throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
	}
	const entry = inventory.sources.find(
		(candidate) =>
			candidate.account === account && candidate.location === location,
	);
	if (!entry) throw failure("UNKNOWN_SOURCE", MESSAGES.UNKNOWN_SOURCE);
	// Destination name is authoritative inventory state. Legacy and lab
	// entries already carry their canonical account names.
	const destName = entry.account;
	if (accountNameSchema.safeParse(destName).success !== true)
		throw failure("UNKNOWN_SOURCE", MESSAGES.UNKNOWN_SOURCE);
	const sourceDir = entry.directory;
	if (
		(location === "environment" || location === "mcp-client") &&
		entry.envVar
	) {
		return {
			entry,
			destName,
			destDir: join(destRoot, destName),
			destRoot,
			home,
			vaultPath,
		};
	}
	if (!sourceDir) throw failure("UNKNOWN_SOURCE", MESSAGES.UNKNOWN_SOURCE);
	const destDir = join(destRoot, destName);
	return {
		entry,
		sourceDir,
		destName,
		destDir,
		destRoot,
		home,
		vaultPath,
	};
}

function toOriginalKeys(input: {
	payPk?: unknown;
	identityPk?: unknown;
	xprv?: unknown;
}): OriginalKeys {
	const payPk = input.payPk;
	const identityPk = input.identityPk;
	const xprv = input.xprv;
	if (!(payPk instanceof PrivateKey))
		throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
	let payPub: string;
	let payWif: string;
	try {
		payPub = payPk.toPublicKey().toString();
		payWif = payPk.toWif();
	} catch {
		throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
	}
	const out: OriginalKeys = { payWif, payPub };
	if (identityPk !== undefined) {
		if (!(identityPk instanceof PrivateKey))
			throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
		try {
			out.identityPub = identityPk.toPublicKey().toString();
			out.identityWif = identityPk.toWif();
		} catch {
			throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
		}
	}
	if (xprv !== undefined) {
		if (typeof xprv !== "string" || xprv.length === 0)
			throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
		try {
			const hd = HD.fromString(xprv);
			if (!hd.isPrivate())
				throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
			out.expectedXpub = hd.toPublic().toString();
			out.xprv = xprv;
		} catch (error) {
			if (error instanceof EmbeddedImportError) throw error;
			throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
		}
	}
	return out;
}

function loadEnvOrClientKeys(selection: TrustedSelection): OriginalKeys {
	const { entry } = selection;
	if (entry.envVar !== "PRIVATE_KEY_WIF")
		throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
	let payment: string | undefined;
	let identity: string | undefined;
	if (entry.location === "environment") {
		const envPayment = process.env.PRIVATE_KEY_WIF;
		const envIdentity = process.env.IDENTITY_KEY_WIF;
		payment =
			typeof envPayment === "string" && envPayment.length > 0
				? envPayment
				: undefined;
		identity =
			typeof envIdentity === "string" && envIdentity.length > 0
				? envIdentity
				: undefined;
	} else if (
		entry.location === "mcp-client" &&
		entry.configPath &&
		entry.serverName
	) {
		payment = readMcpClientEnvValue({
			configPath: entry.configPath,
			serverName: entry.serverName,
			envVar: "PRIVATE_KEY_WIF",
		});
		identity = readMcpClientEnvValue({
			configPath: entry.configPath,
			serverName: entry.serverName,
			envVar: "IDENTITY_KEY_WIF",
		});
	}
	if (!payment)
		throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
	try {
		const payPk = PrivateKey.fromWif(payment);
		const identityPk = identity ? PrivateKey.fromWif(identity) : undefined;
		return toOriginalKeys({ payPk, identityPk });
	} catch (error) {
		if (error instanceof EmbeddedImportError) throw error;
		throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
	}
}

async function loadSourceKeys(
	selection: TrustedSelection,
	sourcePassphrase: string | undefined,
): Promise<OriginalKeys> {
	const { entry, sourceDir } = selection;
	if (entry.location === "environment" || entry.location === "mcp-client") {
		return loadEnvOrClientKeys(selection);
	}
	if (!sourceDir) throw failure("UNKNOWN_SOURCE", MESSAGES.UNKNOWN_SOURCE);
	rejectUnsafeDir(sourceDir);
	if (!entry.encryptedBackup && !entry.plaintextKeys)
		throw failure("MATCHING_KEYS_REQUIRED", MESSAGES.MATCHING_KEYS_REQUIRED);
	if (entry.keyFile === "root.wif" && entry.plaintextKeys) {
		const file = join(sourceDir, "root.wif");
		rejectUnsafePath(file);
		let wif: string;
		try {
			wif = readFileSync(file, "utf8").trim();
		} catch {
			throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
		}
		try {
			const payPk = PrivateKey.fromWif(wif);
			return toOriginalKeys({ payPk });
		} catch {
			throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
		}
	}
	if (entry.encryptedBackup) {
		if (typeof sourcePassphrase !== "string" || !sourcePassphrase)
			throw failure("CREDENTIALS_REQUIRED", MESSAGES.CREDENTIALS_REQUIRED);
		try {
			const manager = new SecureKeyManager({ keyDir: sourceDir });
			const { keys } = await manager.loadKeys(sourcePassphrase);
			return toOriginalKeys(keys);
		} catch (error) {
			if (error instanceof EmbeddedImportError) throw error;
			throw failure("UNLOCK_FAILED", MESSAGES.UNLOCK_FAILED);
		}
	}
	try {
		const manager = new SecureKeyManager({ keyDir: sourceDir });
		return toOriginalKeys(manager.loadLegacyKeys());
	} catch (error) {
		if (error instanceof EmbeddedImportError) throw error;
		throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
	}
}

function rootAddressFor(payWif: string, chain: "main" | "test"): string {
	try {
		const key = PrivateKey.fromWif(payWif);
		return chain === "test" ? key.toAddress([0x6f]) : key.toAddress();
	} catch {
		throw failure("INVALID_KEYS", MESSAGES.INVALID_KEYS);
	}
}

/**
 * Existing addresses are either the root P2PKH or the exact deterministic
 * P1SAT deposit derived with the configured prefix at index 0. No other
 * derivation is inferred.
 */
async function addressMatchesKnown(
	payWif: string,
	chain: "main" | "test",
	prefix: string,
	configured: string,
): Promise<boolean> {
	let key: PrivateKey;
	try {
		key = PrivateKey.fromWif(payWif);
	} catch {
		return false;
	}
	try {
		const root = chain === "test" ? key.toAddress([0x6f]) : key.toAddress();
		if (root === configured) return true;
	} catch {
		return false;
	}
	try {
		const wallet = new ProtoWallet(key);
		const derived = await wallet.getPublicKey({
			protocolID: P1SAT_PROTOCOL,
			keyID: `${prefix} 0`,
			forSelf: true,
		});
		const address =
			chain === "test"
				? PublicKey.fromString(derived.publicKey).toAddress([0x6f])
				: PublicKey.fromString(derived.publicKey).toAddress();
		return address === configured;
	} catch {
		return false;
	}
}

function readExistingConfig(
	destName: string,
	destRoot: string,
): { config: AccountConfig | undefined; revision: string | null } {
	try {
		rejectUnsafeDir(destRoot);
		// Snapshot the revision before and after the config read. An external
		// update between those reads must fail closed instead of pairing an
		// old config with a new revision for a later CAS overwrite.
		const revisionBefore = readAccountRevision(destName, destRoot);
		const config = readAccount(destName, destRoot);
		const revisionAfter = readAccountRevision(destName, destRoot);
		if (revisionBefore !== revisionAfter)
			throw failure("CONFIG_CONFLICT", MESSAGES.CONFIG_CONFLICT);
		return { config, revision: revisionAfter };
	} catch (error) {
		if (error instanceof EmbeddedImportError) throw error;
		throw failure("CONFIG_CONFLICT", MESSAGES.CONFIG_CONFLICT);
	}
}

function assertBindingMatchesExisting(
	keys: OriginalKeys,
	existing: AccountConfig | undefined,
): void {
	const pinned = existing?.vaultBinding;
	if (!pinned) return;
	if (keys.payPub.toLowerCase() !== pinned.payment.publicKey.toLowerCase())
		throw failure("ADDRESS_MISMATCH", MESSAGES.ADDRESS_MISMATCH);
	if (pinned.identity !== undefined) {
		if (
			keys.identityPub === undefined ||
			keys.identityPub.toLowerCase() !== pinned.identity.publicKey.toLowerCase()
		)
			throw failure("ADDRESS_MISMATCH", MESSAGES.ADDRESS_MISMATCH);
	}
	if (pinned.hd !== undefined) {
		if (
			keys.expectedXpub === undefined ||
			keys.expectedXpub !== pinned.hd.expectedXpub
		)
			throw failure("ADDRESS_MISMATCH", MESSAGES.ADDRESS_MISMATCH);
	}
}

function assertStoredMatchesCommitted(
	stored: AccountConfig,
	expected: AccountConfig,
	binding: StoredBinding,
): void {
	if (
		stored.chain !== expected.chain ||
		(stored.address ?? undefined) !== (expected.address ?? undefined) ||
		(stored.storageIdentityKey ?? undefined) !==
			(expected.storageIdentityKey ?? undefined) ||
		(stored.depositPrefix ?? undefined) !==
			(expected.depositPrefix ?? undefined) ||
		(stored.activeRemote ?? undefined) !==
			(expected.activeRemote ?? undefined) ||
		JSON.stringify(stored.backups ?? null) !==
			JSON.stringify(expected.backups ?? null)
	)
		throw failure("CONFIG_CONFLICT", MESSAGES.CONFIG_CONFLICT);
	const storedBinding = stored.vaultBinding;
	if (!storedBinding || !bindingsMatchCommitted(storedBinding, binding))
		throw failure("CONFIG_CONFLICT", MESSAGES.CONFIG_CONFLICT);
}

function bindingsMatchCommitted(
	stored: StoredBinding,
	committed: StoredBinding,
): boolean {
	if (
		stored.version !== committed.version ||
		stored.contract !== committed.contract ||
		stored.vaultId !== committed.vaultId ||
		stored.payment.entryId !== committed.payment.entryId ||
		stored.payment.publicKey.toLowerCase() !==
			committed.payment.publicKey.toLowerCase()
	)
		return false;
	if ((stored.identity === undefined) !== (committed.identity === undefined))
		return false;
	if (stored.identity !== undefined && committed.identity !== undefined) {
		if (
			stored.identity.entryId !== committed.identity.entryId ||
			stored.identity.publicKey.toLowerCase() !==
				committed.identity.publicKey.toLowerCase()
		)
			return false;
	}
	if ((stored.hd === undefined) !== (committed.hd === undefined)) return false;
	if (stored.hd !== undefined && committed.hd !== undefined) {
		if (
			stored.hd.entryId !== committed.hd.entryId ||
			stored.hd.expectedXpub !== committed.hd.expectedXpub
		)
			return false;
	}
	return true;
}

function resolveChain(
	existing: AccountConfig | undefined,
	requested: "main" | "test" | undefined,
): "main" | "test" {
	if (existing && requested !== undefined && requested !== existing.chain)
		throw failure("CHAIN_MISMATCH", MESSAGES.CHAIN_MISMATCH);
	return existing?.chain ?? requested ?? "main";
}

/** Fail before any write when a live SQLite sidecar makes a copy unsafe. */
function assertDatabasesCopyable(selection: TrustedSelection): void {
	if (!selection.sourceDir) return;
	// Same-directory migration performs no DB copy: the database and any
	// sidecars stay in place untouched, so sidecars must not deny the import.
	if (resolve(selection.sourceDir) === resolve(selection.destDir)) return;
	for (const name of selection.entry.walletDatabases) {
		if (!DB_NAME_PATTERN.test(name))
			throw failure("DB_UNSAFE", MESSAGES.DB_UNSAFE);
		for (const suffix of ["-wal", "-shm"]) {
			const sidecar = join(selection.sourceDir, `${name}${suffix}`);
			try {
				// Any existing sidecar path (regular file, symlink, or other)
				// makes an ordinary copy unsafe for an actual copy.
				lstatSync(sidecar);
				throw failure("DB_UNSAFE", MESSAGES.DB_UNSAFE);
			} catch (error) {
				if (error instanceof EmbeddedImportError) throw error;
				const code = (error as NodeJS.ErrnoException)?.code;
				if (code !== undefined && code !== "ENOENT")
					throw failure("DB_UNSAFE", MESSAGES.DB_UNSAFE);
			}
		}
	}
}

/**
 * Read-only pre-flight: a differing destination database fails before any
 * write instead of being replaced.
 */
function assertNoDestinationDbCollision(selection: TrustedSelection): void {
	if (!selection.sourceDir) return;
	if (resolve(selection.sourceDir) === resolve(selection.destDir)) return;
	for (const name of selection.entry.walletDatabases) {
		if (!DB_NAME_PATTERN.test(name))
			throw failure("DB_UNSAFE", MESSAGES.DB_UNSAFE);
		const from = join(selection.sourceDir, name);
		const to = join(selection.destDir, name);
		let fromBytes: Buffer | null = null;
		let toBytes: Buffer | null = null;
		try {
			rejectUnsafePath(from);
			fromBytes = existsSync(from) ? readFileSync(from) : null;
		} catch (error) {
			if (error instanceof EmbeddedImportError) throw error;
			throw failure("SOURCE_UNAVAILABLE", MESSAGES.SOURCE_UNAVAILABLE);
		}
		if (fromBytes === null) continue;
		try {
			rejectUnsafePath(to);
			toBytes = existsSync(to) ? readFileSync(to) : null;
		} catch (error) {
			if (error instanceof EmbeddedImportError) throw error;
			throw failure("DB_CONFLICT", MESSAGES.DB_CONFLICT);
		}
		if (toBytes !== null && digest(toBytes) !== digest(fromBytes))
			throw failure("DB_CONFLICT", MESSAGES.DB_CONFLICT);
	}
}

async function copyInventoryDatabases(
	selection: TrustedSelection,
): Promise<void> {
	if (!selection.sourceDir) return;
	if (resolve(selection.sourceDir) === resolve(selection.destDir)) return;
	if (selection.entry.walletDatabases.length === 0) return;
	try {
		secureDirectory(selection.destDir);
	} catch {
		throw failure("DB_CONFLICT", MESSAGES.DB_CONFLICT);
	}
	for (const name of selection.entry.walletDatabases) {
		if (!DB_NAME_PATTERN.test(name))
			throw failure("DB_CONFLICT", MESSAGES.DB_CONFLICT);
		const from = join(selection.sourceDir, name);
		const to = join(selection.destDir, name);
		let fromBytes: Buffer;
		try {
			rejectUnsafePath(from);
			fromBytes = readFileSync(from);
		} catch (error) {
			if (error instanceof EmbeddedImportError) throw error;
			throw failure("DB_CONFLICT", MESSAGES.DB_CONFLICT);
		}
		let toBytes: Buffer | null = null;
		try {
			rejectUnsafePath(to);
			toBytes = existsSync(to) ? readFileSync(to) : null;
		} catch (error) {
			if (error instanceof EmbeddedImportError) throw error;
			throw failure("DB_CONFLICT", MESSAGES.DB_CONFLICT);
		}
		if (toBytes !== null) {
			if (digest(toBytes) === digest(fromBytes)) continue;
			throw failure("DB_CONFLICT", MESSAGES.DB_CONFLICT);
		}
		try {
			rejectUnsafeDir(selection.destDir);
			await copyFile(from, to, fsConstants.COPYFILE_EXCL);
			chmodSync(to, 0o600);
			const copied = readFileSync(to);
			if (digest(copied) !== digest(fromBytes))
				throw failure("DB_CONFLICT", MESSAGES.DB_CONFLICT);
		} catch (error) {
			if (error instanceof EmbeddedImportError) throw error;
			throw failure("DB_CONFLICT", MESSAGES.DB_CONFLICT);
		}
	}
}

async function importKeysToVault(
	vaultPath: string,
	loadModule: (() => Promise<unknown>) | undefined,
	input: {
		password: string;
		passwordConfirmation?: string;
		label: string;
		keys: OriginalKeys;
	},
): Promise<EmbeddedVaultReceipt> {
	let io: ReturnType<typeof createEmbeddedVaultIo>;
	try {
		io = createEmbeddedVaultIo({ vaultPath, loadModule });
	} catch {
		throw failure("VAULT_FAILED", MESSAGES.VAULT_FAILED);
	}
	let receipt: EmbeddedVaultReceipt;
	try {
		receipt = await io.importKeys({
			password: input.password,
			passwordConfirmation: input.passwordConfirmation,
			label: input.label,
			keys: {
				payPk: input.keys.payWif,
				...(input.keys.identityWif !== undefined
					? { identityPk: input.keys.identityWif }
					: {}),
				...(input.keys.xprv !== undefined ? { xprv: input.keys.xprv } : {}),
			},
		});
	} catch (error) {
		if (error instanceof EmbeddedImportError) throw error;
		throw failure("VAULT_FAILED", MESSAGES.VAULT_FAILED);
	}
	try {
		const unlocked = await io.unlock({
			password: input.password,
			binding: receipt,
		});
		try {
			if (
				unlocked.payPk?.toPublicKey().toString().toLowerCase() !==
					input.keys.payPub.toLowerCase() ||
				unlocked.payPk?.toPublicKey().toString().toLowerCase() !==
					receipt.payment.publicKey.toLowerCase()
			)
				throw failure("VAULT_FAILED", MESSAGES.VAULT_FAILED);
			if (input.keys.identityPub !== undefined) {
				if (
					unlocked.identityPk?.toPublicKey().toString().toLowerCase() !==
						input.keys.identityPub.toLowerCase() ||
					receipt.identity?.publicKey.toLowerCase() !==
						input.keys.identityPub.toLowerCase()
				)
					throw failure("VAULT_FAILED", MESSAGES.VAULT_FAILED);
			} else if (receipt.identity !== undefined) {
				throw failure("VAULT_FAILED", MESSAGES.VAULT_FAILED);
			}
			if (input.keys.xprv !== undefined) {
				if (unlocked.xprv !== input.keys.xprv)
					throw failure("VAULT_FAILED", MESSAGES.VAULT_FAILED);
				let xpub: string;
				try {
					xpub = HD.fromString(unlocked.xprv).toPublic().toString();
				} catch {
					throw failure("VAULT_FAILED", MESSAGES.VAULT_FAILED);
				}
				if (
					receipt.hd === undefined ||
					xpub !== receipt.hd.expectedXpub ||
					xpub !== input.keys.expectedXpub
				)
					throw failure("VAULT_FAILED", MESSAGES.VAULT_FAILED);
			} else if (receipt.hd !== undefined) {
				throw failure("VAULT_FAILED", MESSAGES.VAULT_FAILED);
			}
		} finally {
			try {
				io.lock();
			} catch {
				// Verification sessions are always revoked.
			}
		}
	} catch (error) {
		if (error instanceof EmbeddedImportError) throw error;
		try {
			io.lock();
		} catch {
			// Failed verification always revokes the session.
		}
		throw failure("VAULT_FAILED", MESSAGES.VAULT_FAILED);
	}
	return receipt;
}

function bindingFromReceipt(receipt: EmbeddedVaultReceipt): StoredBinding {
	try {
		return embeddedVaultBindingSchema.parse({
			version: 1,
			contract: "embedded-roots-v1",
			vaultId: receipt.vaultId,
			payment: receipt.payment,
			...(receipt.identity !== undefined ? { identity: receipt.identity } : {}),
			...(receipt.hd !== undefined ? { hd: receipt.hd } : {}),
		});
	} catch {
		throw failure("VAULT_FAILED", MESSAGES.VAULT_FAILED);
	}
}

function parsePlaintextBackupKeys(backupText: string): OriginalKeys {
	let raw: unknown;
	try {
		raw = JSON.parse(backupText);
	} catch {
		throw failure("BACKUP_INVALID", MESSAGES.BACKUP_INVALID);
	}
	if (raw === null || typeof raw !== "object" || Array.isArray(raw))
		throw failure("BACKUP_INVALID", MESSAGES.BACKUP_INVALID);
	const record = raw as Record<string, unknown>;
	const nested =
		record.bsvMcp !== undefined &&
		typeof record.bsvMcp === "object" &&
		record.bsvMcp !== null
			? (record.bsvMcp as Record<string, unknown>)
			: {};
	const wif = record.wif ?? record.payPk;
	const identityPk = nested.identityPk ?? record.identityPk;
	const xprv = nested.xprv ?? record.xprv;
	if (typeof wif !== "string" || wif.length === 0)
		throw failure("BACKUP_INVALID", MESSAGES.BACKUP_INVALID);
	let payPk: PrivateKey;
	try {
		payPk = PrivateKey.fromWif(wif);
	} catch {
		throw failure("BACKUP_INVALID", MESSAGES.BACKUP_INVALID);
	}
	let identity: PrivateKey | undefined;
	if (identityPk !== undefined) {
		if (typeof identityPk !== "string" || identityPk.length === 0)
			throw failure("BACKUP_INVALID", MESSAGES.BACKUP_INVALID);
		try {
			identity = PrivateKey.fromWif(identityPk);
		} catch {
			throw failure("BACKUP_INVALID", MESSAGES.BACKUP_INVALID);
		}
	}
	let xprvValue: string | undefined;
	if (xprv !== undefined) {
		if (typeof xprv !== "string" || xprv.length === 0)
			throw failure("BACKUP_INVALID", MESSAGES.BACKUP_INVALID);
		try {
			const hd = HD.fromString(xprv);
			if (!hd.isPrivate())
				throw failure("BACKUP_INVALID", MESSAGES.BACKUP_INVALID);
			xprvValue = xprv;
		} catch (error) {
			if (error instanceof EmbeddedImportError) throw error;
			throw failure("BACKUP_INVALID", MESSAGES.BACKUP_INVALID);
		}
	}
	return toOriginalBackupKeys(payPk, identity, xprvValue);
}

function toOriginalBackupKeys(
	payPk: PrivateKey,
	identityPk: PrivateKey | undefined,
	xprv: string | undefined,
): OriginalKeys {
	try {
		const out: OriginalKeys = {
			payWif: payPk.toWif(),
			payPub: payPk.toPublicKey().toString(),
		};
		if (identityPk !== undefined) {
			out.identityWif = identityPk.toWif();
			out.identityPub = identityPk.toPublicKey().toString();
		}
		if (xprv !== undefined) {
			out.expectedXpub = HD.fromString(xprv).toPublic().toString();
			out.xprv = xprv;
		}
		return out;
	} catch {
		throw failure("BACKUP_INVALID", MESSAGES.BACKUP_INVALID);
	}
}

async function parseBackupKeys(
	backupText: string,
	sourcePassphrase: string | undefined,
): Promise<OriginalKeys> {
	if (typeof sourcePassphrase === "string" && sourcePassphrase.length > 0) {
		try {
			const keys = await decodeEncryptedKeys(backupText, sourcePassphrase);
			if (!keys.payPk) throw failure("BACKUP_INVALID", MESSAGES.BACKUP_INVALID);
			return toOriginalBackupKeys(keys.payPk, keys.identityPk, keys.xprv);
		} catch (error) {
			if (error instanceof EmbeddedImportError) throw error;
			throw failure("BACKUP_INVALID", MESSAGES.BACKUP_INVALID);
		}
	}
	return parsePlaintextBackupKeys(backupText);
}

export function createEmbeddedImportBackend(
	options: EmbeddedImportBackendOptions,
): EmbeddedImportBackend {
	const vaultPath = resolveVaultPath(options?.vaultPath);
	const home = resolveTrustedHome(options?.home);
	const destRoot = resolveDestRoot(options?.accountsDirectory, home);
	const requestedChain = options?.chain;
	if (
		requestedChain !== undefined &&
		requestedChain !== "main" &&
		requestedChain !== "test"
	)
		throw failure("INVALID_OPTIONS", MESSAGES.INVALID_OPTIONS);
	const loadModule = options?.loadModule;

	async function runImport(
		input: EmbeddedImportInput,
	): Promise<EmbeddedImportResult> {
		if (!input || typeof input !== "object")
			throw failure("INVALID_INPUT", MESSAGES.INVALID_INPUT);
		if (typeof input.password !== "string" || input.password.length === 0)
			throw failure("CREDENTIALS_REQUIRED", MESSAGES.CREDENTIALS_REQUIRED);
		const selection = selectTrustedSource(
			input.source,
			home,
			destRoot,
			vaultPath,
		);
		// Confirmation is enforced before any private material is read or
		// any byte is written. Inventory above inspects filenames only.
		assertConfirmation(input.confirmation);
		if (
			input.passwordConfirmation !== undefined &&
			typeof input.passwordConfirmation !== "string"
		)
			throw failure("INVALID_INPUT", MESSAGES.INVALID_INPUT);
		assertDatabasesCopyable(selection);
		assertNoDestinationDbCollision(selection);
		const snapshot = readExistingConfig(selection.destName, selection.destRoot);
		const chain = resolveChain(snapshot.config, requestedChain);
		const keys = await loadSourceKeys(selection, input.sourcePassphrase);
		// Recheck the revision after the source unlock: a concurrent writer
		// must fail closed instead of overwriting.
		const rechecked = readExistingConfig(
			selection.destName,
			selection.destRoot,
		);
		if (rechecked.revision !== snapshot.revision)
			throw failure("CONFIG_CONFLICT", MESSAGES.CONFIG_CONFLICT);
		const liveConfig = rechecked.config;
		const rootAddress = rootAddressFor(keys.payWif, chain);
		if (liveConfig?.address !== undefined) {
			const prefix = liveConfig.depositPrefix ?? "mcp";
			const matches = await addressMatchesKnown(
				keys.payWif,
				chain,
				prefix,
				liveConfig.address,
			);
			if (!matches)
				throw failure("ADDRESS_MISMATCH", MESSAGES.ADDRESS_MISMATCH);
		}
		// Pinned roots can never rotate: an existing binding must match the
		// original keys exactly before any Vault write.
		assertBindingMatchesExisting(keys, liveConfig);
		const receipt = await importKeysToVault(vaultPath, loadModule, {
			password: input.password,
			passwordConfirmation: input.passwordConfirmation,
			label: selection.destName,
			keys,
		});
		const binding = bindingFromReceipt(receipt);
		// Vault data is durable now; the config commit is a separate CAS step.
		// A later failure retains the vault and reports reconciliation.
		// Recheck DB safety immediately before copying: sidecars may have
		// appeared while the Vault await was in flight.
		assertDatabasesCopyable(selection);
		assertNoDestinationDbCollision(selection);
		await copyInventoryDatabases(selection);
		const base: AccountConfig = liveConfig ?? {
			...newAccountConfig(chain, rootAddress),
			...(selection.entry.storageIdentityKey
				? { storageIdentityKey: selection.entry.storageIdentityKey }
				: {}),
			...(selection.entry.depositPrefix
				? { depositPrefix: selection.entry.depositPrefix }
				: {}),
		};
		const next: AccountConfig =
			liveConfig !== undefined
				? {
						...liveConfig,
						vaultBinding: binding,
						...(liveConfig.address === undefined
							? { address: rootAddress }
							: {}),
					}
				: { ...base, vaultBinding: binding };
		let stored: AccountConfig;
		try {
			writeAccount(selection.destName, next, selection.destRoot, {
				expectedRevision: snapshot.revision,
			});
			const reread = readAccount(selection.destName, selection.destRoot);
			if (!reread)
				throw failure("RECONCILIATION_NEEDED", MESSAGES.RECONCILIATION_NEEDED);
			// Never return a stale binding alongside concurrently changed
			// persisted config: the reread must match what was committed.
			assertStoredMatchesCommitted(reread, next, binding);
			stored = reread;
		} catch (error) {
			if (error instanceof EmbeddedImportError) throw error;
			const message = error instanceof Error ? error.message : "";
			if (message.includes("ACCOUNT_CONFIG_CHANGED"))
				throw failure("CONFIG_CONFLICT", MESSAGES.CONFIG_CONFLICT);
			throw failure("RECONCILIATION_NEEDED", MESSAGES.RECONCILIATION_NEEDED);
		}
		const address = stored.address ?? rootAddress;
		return { accountName: selection.destName, address, binding };
	}

	async function runImportBackup(
		input: EmbeddedImportBackupInput,
	): Promise<EmbeddedImportResult> {
		if (!input || typeof input !== "object")
			throw failure("INVALID_INPUT", MESSAGES.INVALID_INPUT);
		// Confirmation precedes any parse of secret backup contents.
		assertConfirmation(input.confirmation);
		if (
			typeof input.backupText !== "string" ||
			input.backupText.length === 0 ||
			typeof input.backupName !== "string" ||
			input.backupName.length === 0 ||
			typeof input.accountName !== "string" ||
			typeof input.destinationPassphrase !== "string" ||
			input.destinationPassphrase.length === 0
		)
			throw failure("INVALID_INPUT", MESSAGES.INVALID_INPUT);
		if (
			input.passwordConfirmation !== undefined &&
			typeof input.passwordConfirmation !== "string"
		)
			throw failure("INVALID_INPUT", MESSAGES.INVALID_INPUT);
		if (accountNameSchema.safeParse(input.accountName).success !== true)
			throw failure("ACCOUNT_INVALID", MESSAGES.ACCOUNT_INVALID);
		let byteLength = 0;
		try {
			byteLength = Buffer.byteLength(input.backupText, "utf8");
		} catch {
			throw failure("BACKUP_INVALID", MESSAGES.BACKUP_INVALID);
		}
		if (byteLength === 0 || byteLength > MAX_BACKUP_BYTES)
			throw failure(
				byteLength > MAX_BACKUP_BYTES ? "BACKUP_TOO_LARGE" : "BACKUP_INVALID",
				byteLength > MAX_BACKUP_BYTES
					? MESSAGES.BACKUP_TOO_LARGE
					: MESSAGES.BACKUP_INVALID,
			);
		// backupName is a display label only and is never opened as a path.
		const destName = input.accountName;
		const destDir = join(destRoot, destName);
		const keys = await parseBackupKeys(
			input.backupText,
			input.sourcePassphrase,
		);
		const snapshot = readExistingConfig(destName, destRoot);
		const chain = resolveChain(snapshot.config, requestedChain);
		const rootAddress = rootAddressFor(keys.payWif, chain);
		if (snapshot.config?.address !== undefined) {
			const prefix = snapshot.config.depositPrefix ?? "mcp";
			const matches = await addressMatchesKnown(
				keys.payWif,
				chain,
				prefix,
				snapshot.config.address,
			);
			if (!matches)
				throw failure("ADDRESS_MISMATCH", MESSAGES.ADDRESS_MISMATCH);
		} else if (snapshot.config !== undefined) {
			throw failure("MATCHING_KEYS_REQUIRED", MESSAGES.MATCHING_KEYS_REQUIRED);
		} else {
			try {
				rejectUnsafeDir(destRoot);
				if (existsSync(destDir)) {
					rejectUnsafeDir(destDir);
					for (const name of [
						"wallet-main.db",
						"wallet-test.db",
						"wallet.db",
					]) {
						const candidate = join(destDir, name);
						try {
							const stat = lstatSync(candidate);
							if (!stat.isSymbolicLink() && stat.isFile())
								throw failure(
									"MATCHING_KEYS_REQUIRED",
									MESSAGES.MATCHING_KEYS_REQUIRED,
								);
						} catch (error) {
							if (error instanceof EmbeddedImportError) throw error;
							const code = (error as NodeJS.ErrnoException)?.code;
							if (code !== undefined && code !== "ENOENT")
								throw failure(
									"MATCHING_KEYS_REQUIRED",
									MESSAGES.MATCHING_KEYS_REQUIRED,
								);
						}
					}
				}
			} catch (error) {
				if (error instanceof EmbeddedImportError) throw error;
				throw failure(
					"MATCHING_KEYS_REQUIRED",
					MESSAGES.MATCHING_KEYS_REQUIRED,
				);
			}
		}
		// Pinned roots can never rotate: an existing binding must match the
		// uploaded keys exactly before any Vault write.
		assertBindingMatchesExisting(keys, snapshot.config);
		const receipt = await importKeysToVault(vaultPath, loadModule, {
			password: input.destinationPassphrase,
			passwordConfirmation: input.passwordConfirmation,
			label: destName,
			keys,
		});
		const binding = bindingFromReceipt(receipt);
		// Uploads never touch existing databases; the config CAS is separate
		// from the durable vault write.
		const next: AccountConfig =
			snapshot.config !== undefined
				? { ...snapshot.config, vaultBinding: binding }
				: {
						...newAccountConfig(chain, rootAddress),
						vaultBinding: binding,
					};
		try {
			writeAccount(destName, next, destRoot, {
				expectedRevision: snapshot.revision,
			});
			const reread = readAccount(destName, destRoot);
			if (!reread)
				throw failure("RECONCILIATION_NEEDED", MESSAGES.RECONCILIATION_NEEDED);
			// Never return a stale binding alongside concurrently changed
			// persisted config: the reread must match what was committed.
			assertStoredMatchesCommitted(reread, next, binding);
			return {
				accountName: destName,
				address: reread.address ?? rootAddress,
				binding,
			};
		} catch (error) {
			if (error instanceof EmbeddedImportError) throw error;
			const message = error instanceof Error ? error.message : "";
			if (message.includes("ACCOUNT_CONFIG_CHANGED"))
				throw failure("CONFIG_CONFLICT", MESSAGES.CONFIG_CONFLICT);
			throw failure("RECONCILIATION_NEEDED", MESSAGES.RECONCILIATION_NEEDED);
		}
	}

	return {
		import: runImport,
		importBackup: runImportBackup,
	};
}
