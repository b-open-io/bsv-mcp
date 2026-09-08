import { createHash, randomBytes } from "node:crypto";
import {
	chmodSync,
	closeSync,
	existsSync,
	constants as fsConstants,
	fstatSync,
	fsyncSync,
	lstatSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const accountNameSchema = z
	.string()
	.regex(
		/^[a-z0-9][a-z0-9_-]{0,63}$/,
		"Use 1–64 lowercase letters, digits, underscores or hyphens",
	);
/** Default active wallet-storage provider for newly-created embedded accounts. */
export const DEFAULT_STORAGE_REMOTE_URL = "https://wallet.1sat.app";
const remote = z
	.string()
	.url()
	.refine((s) => {
		const u = new URL(s);
		return (
			!u.username &&
			!u.password &&
			!u.search &&
			!u.hash &&
			(u.protocol === "https:" ||
				(u.protocol === "http:" &&
					["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))
		);
	});

const compressedPublicKeySchema = z
	.string()
	.regex(/^0[23][0-9a-fA-F]{64}$/, "Invalid compressed public key");
const nonEmptyStringSchema = z.string().min(1);
const vaultPaymentSchema = z
	.object({
		entryId: nonEmptyStringSchema,
		publicKey: compressedPublicKeySchema,
	})
	.strict();
const vaultHdSchema = z
	.object({
		entryId: nonEmptyStringSchema,
		expectedXpub: nonEmptyStringSchema,
	})
	.strict();

export const embeddedVaultBindingSchema = z
	.object({
		version: z.literal(1),
		contract: z.literal("embedded-roots-v1"),
		vaultId: nonEmptyStringSchema,
		payment: vaultPaymentSchema,
		identity: vaultPaymentSchema.optional(),
		hd: vaultHdSchema.optional(),
	})
	.strict();
export type EmbeddedVaultBinding = z.infer<typeof embeddedVaultBindingSchema>;

const vaultBindingHistoryItemSchema = z
	.object({
		binding: embeddedVaultBindingSchema,
		changedAt: z.string().datetime(),
	})
	.strict();

export const accountConfigSchema = z
	.object({
		chain: z.enum(["main", "test"]),
		storageIdentityKey: z.string().min(1).max(200),
		activeRemote: remote.optional(),
		backups: z.array(remote).optional(),
		address: z
			.string()
			.regex(/^[123mn][1-9A-HJ-NP-Za-km-z]{24,40}$/)
			.optional(),
		depositPrefix: z.enum(["mcp", "1sat"]).default("mcp"),
		vaultBinding: embeddedVaultBindingSchema.optional(),
		vaultBindingHistory: z.array(vaultBindingHistoryItemSchema).optional(),
	})
	.strict();
export type AccountConfig = z.infer<typeof accountConfigSchema>;

/**
 * Resolve the storage topology passed to the One Sat wallet factory.
 *
 * `REMOTE_STORAGE_URL` is a deployment override and is deliberately kept out
 * of the account file. A URL listed as both active and backup would otherwise
 * be connected twice by the SDK, so remove the active URL from the backup
 * list here. This function is pure so config behavior can be tested without
 * creating a wallet or making an authenticated request.
 */
export function resolveStorageConfig(
	config: Pick<AccountConfig, "activeRemote" | "backups"> | undefined,
	activeRemoteOverride?: string,
): Pick<AccountConfig, "activeRemote" | "backups"> {
	const validate = (url: string) => {
		if (!remote.safeParse(url).success)
			throw new Error("Wallet storage URL must be HTTPS or loopback HTTP");
		return url;
	};
	const activeRemote =
		activeRemoteOverride === undefined
			? config?.activeRemote
			: validate(activeRemoteOverride);
	const backups = config?.backups
		?.map(validate)
		.filter((url) => url !== activeRemote);
	return { activeRemote, backups };
}
export function accountsRoot() {
	const base = join(homedir(), ".bsv-mcp");
	regularPath(base, true);
	return join(base, "accounts");
}
export function accountName(value = process.env.BSV_MCP_ACCOUNT ?? "default") {
	return accountNameSchema.parse(value);
}
export function accountDir(name = accountName(), root = accountsRoot()) {
	return join(root, accountName(name));
}
/** Reject symlinks even on reads so an account cannot escape its canonical directory. */
export function regularPath(file: string, directory = false) {
	if (!existsSync(file)) return;
	const stat = lstatSync(file);
	if (
		stat.isSymbolicLink() ||
		(directory ? !stat.isDirectory() : !stat.isFile())
	)
		throw new Error(
			"Account path must be a regular file or directory, not a link",
		);
}
export function secureDirectory(dir: string) {
	regularPath(dir, true);
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	chmodSync(dir, 0o700);
}
export function readAccount(
	name = accountName(),
	root = accountsRoot(),
): AccountConfig | undefined {
	regularPath(root, true);
	const dir = accountDir(name, root);
	regularPath(dir, true);
	const file = join(dir, "config.json");
	regularPath(file);
	if (!existsSync(file)) return undefined;
	try {
		return accountConfigSchema.parse(JSON.parse(readFileSync(file, "utf8")));
	} catch {
		throw new Error(`Invalid account configuration at ${file}`);
	}
}

function sha256Hex(raw: Buffer | string): string {
	return createHash("sha256").update(raw).digest("hex");
}

export function readAccountRevision(
	name = accountName(),
	root = accountsRoot(),
): string | null {
	regularPath(root, true);
	const dir = accountDir(name, root);
	regularPath(dir, true);
	const file = join(dir, "config.json");
	regularPath(file);
	if (!existsSync(file)) return null;
	const raw = readFileSync(file);
	try {
		accountConfigSchema.parse(JSON.parse(raw.toString("utf8")));
	} catch {
		throw new Error(`Invalid account configuration at ${file}`);
	}
	return sha256Hex(raw);
}

function configLockPath(dir: string) {
	return join(dir, ".config.json.lock");
}

function sortKeysDeep(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeysDeep);
	if (value !== null && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort())
			out[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
		return out;
	}
	return value;
}

function bindingsEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(sortKeysDeep(a)) === JSON.stringify(sortKeysDeep(b));
}

function tryFsyncFile(fd: number) {
	try {
		fsyncSync(fd);
	} catch {
		// Fsync is best-effort on platforms that do not support it.
	}
}

function tryFsyncDir(dir: string) {
	try {
		const fd = openSync(dir, "r");
		try {
			fsyncSync(fd);
		} finally {
			closeSync(fd);
		}
	} catch {
		// Directory fsync is not supported everywhere (notably macOS).
	}
}

export type WriteAccountOptions = {
	expectedRevision?: string | null;
};

export function writeAccount(
	name: string,
	config: AccountConfig,
	root = accountsRoot(),
	options?: WriteAccountOptions,
) {
	const candidate = accountConfigSchema.parse(config);
	regularPath(root, true);
	secureDirectory(root);
	const dir = accountDir(name, root);
	secureDirectory(dir);
	const file = join(dir, "config.json");
	regularPath(file);
	const lockPath = configLockPath(dir);
	try {
		lstatSync(lockPath);
		throw new Error(
			"ACCOUNT_CONFIG_BUSY: account config is locked by another writer",
		);
	} catch (error) {
		if (error instanceof Error && error.message.includes("ACCOUNT_CONFIG_BUSY"))
			throw error;
		// ENOENT means no lock exists; any other lstat error besides missing
		// file is treated as a busy lock rather than auto-stealing it.
		if (
			error instanceof Error &&
			"code" in error &&
			(error as NodeJS.ErrnoException).code !== "ENOENT"
		) {
			throw new Error(
				"ACCOUNT_CONFIG_BUSY: account config lock cannot be inspected",
			);
		}
	}
	let lockFd: number | undefined;
	let lockDev: string | number | bigint | undefined;
	let lockIno: string | number | bigint | undefined;
	let lockClosed = false;
	try {
		lockFd = openSync(
			lockPath,
			fsConstants.O_WRONLY |
				fsConstants.O_CREAT |
				fsConstants.O_EXCL |
				fsConstants.O_NOFOLLOW,
			0o600,
		);
		const owned = fstatSync(lockFd);
		lockDev = owned.dev as typeof lockDev;
		lockIno = owned.ino as typeof lockIno;
		writeSync(lockFd, `${process.pid}\n`);
	} catch (error) {
		if (lockFd !== undefined) {
			try {
				closeSync(lockFd);
			} catch {
				// Best-effort close of a lock that failed to initialize.
			}
			lockClosed = true;
			// Only remove the path if it is still the exact file just created.
			try {
				const current = lstatSync(lockPath);
				if (
					!current.isSymbolicLink() &&
					current.dev === lockDev &&
					current.ino === lockIno
				) {
					try {
						rmSync(lockPath, { force: true });
					} catch {
						// Best-effort cleanup of an owned lock.
					}
				}
			} catch {
				// Lock path already gone or inaccessible; nothing to clean.
			}
			lockFd = undefined;
		}
		if (error instanceof Error && error.message.includes("ACCOUNT_CONFIG_"))
			throw error;
		throw new Error(
			"ACCOUNT_CONFIG_BUSY: account config is locked by another writer",
		);
	}
	let tempPath: string | undefined;
	try {
		regularPath(file);
		let currentRaw: Buffer | null = null;
		let existing: AccountConfig | undefined;
		if (existsSync(file)) {
			currentRaw = readFileSync(file);
			try {
				existing = accountConfigSchema.parse(
					JSON.parse(currentRaw.toString("utf8")),
				);
			} catch {
				throw new Error(`Invalid account configuration at ${file}`);
			}
		}
		const expected = options?.expectedRevision;
		if (expected !== undefined) {
			const currentRevision = currentRaw ? sha256Hex(currentRaw) : null;
			if (expected === null) {
				if (currentRevision !== null)
					throw new Error(
						"ACCOUNT_CONFIG_CHANGED: account config already exists",
					);
			} else if (currentRevision !== expected) {
				throw new Error(
					"ACCOUNT_CONFIG_CHANGED: account config revision mismatch",
				);
			}
		}
		const existingHistory = existing?.vaultBindingHistory ?? [];
		const candidateHistory = candidate.vaultBindingHistory ?? [];
		const mergedHistory: Array<{
			binding: EmbeddedVaultBinding;
			changedAt: string;
		}> = [...existingHistory];
		for (const entry of candidateHistory) {
			const duplicate = mergedHistory.some(
				(kept) =>
					kept.changedAt === entry.changedAt &&
					bindingsEqual(kept.binding, entry.binding),
			);
			if (!duplicate) mergedHistory.push(entry);
		}
		const existingBinding = existing?.vaultBinding;
		const candidateBinding = candidate.vaultBinding;
		if (
			existingBinding !== undefined &&
			!bindingsEqual(existingBinding, candidateBinding)
		) {
			mergedHistory.push({
				binding: existingBinding,
				changedAt: new Date().toISOString(),
			});
		}
		const finalConfig: AccountConfig = { ...candidate };
		if (existing !== undefined) {
			if (finalConfig.address === undefined && existing.address !== undefined)
				finalConfig.address = existing.address;
			if (
				finalConfig.activeRemote === undefined &&
				existing.activeRemote !== undefined
			)
				finalConfig.activeRemote = existing.activeRemote;
			if (finalConfig.backups === undefined && existing.backups !== undefined)
				finalConfig.backups = [...existing.backups];
		}
		if (mergedHistory.length > 0) {
			finalConfig.vaultBindingHistory = mergedHistory;
		} else {
			delete finalConfig.vaultBindingHistory;
		}
		const data = accountConfigSchema.parse(finalConfig);
		tempPath = join(dir, `.config-${randomBytes(8).toString("hex")}.tmp`);
		const payload = `${JSON.stringify(data, null, 2)}\n`;
		const fd = openSync(tempPath, "wx", 0o600);
		try {
			writeSync(fd, payload);
			tryFsyncFile(fd);
		} finally {
			closeSync(fd);
		}
		chmodSync(tempPath, 0o600);
		renameSync(tempPath, file);
		tempPath = undefined;
		try {
			chmodSync(file, 0o600);
		} catch {
			// Preserve restrictive mode where the platform permits it.
		}
		tryFsyncDir(dir);
	} finally {
		if (tempPath !== undefined) {
			try {
				rmSync(tempPath, { force: true });
			} catch {
				// Best-effort cleanup of an owned temp file.
			}
		}
		if (lockFd !== undefined && !lockClosed) {
			let stillOurs = false;
			let ownedDev: typeof lockDev;
			let ownedIno: typeof lockIno;
			try {
				const ownedStat = fstatSync(lockFd);
				ownedDev = ownedStat.dev as typeof lockDev;
				ownedIno = ownedStat.ino as typeof lockIno;
			} catch {
				ownedDev = lockDev;
				ownedIno = lockIno;
			}
			try {
				const current = lstatSync(lockPath);
				stillOurs =
					!current.isSymbolicLink() &&
					current.dev === ownedDev &&
					current.ino === ownedIno;
			} catch {
				stillOurs = false;
			}
			if (stillOurs) {
				try {
					rmSync(lockPath);
				} catch {
					// Windows cannot unlink an open file: close, re-verify, retry.
					try {
						closeSync(lockFd);
					} catch {
						// Best-effort close of an owned lock.
					}
					lockClosed = true;
					try {
						const current = lstatSync(lockPath);
						if (
							!current.isSymbolicLink() &&
							current.dev === ownedDev &&
							current.ino === ownedIno
						) {
							try {
								rmSync(lockPath);
							} catch {
								// Best-effort release of an owned lock.
							}
						}
					} catch {
						// Lock path already gone; nothing to clean.
					}
				}
			}
			if (!lockClosed) {
				try {
					closeSync(lockFd);
				} catch {
					// Best-effort close of an owned lock.
				}
				lockClosed = true;
			}
			lockFd = undefined;
		}
	}
}
export function listAccounts(root = accountsRoot()) {
	regularPath(root, true);
	if (!existsSync(root)) return [];
	return readdirSync(root)
		.filter((name) => accountNameSchema.safeParse(name).success)
		.sort()
		.map((name) => {
			const config = readAccount(name, root);
			return {
				name,
				chain: config?.chain,
				address: config?.address ?? null,
				encrypted: existsSync(join(accountDir(name, root), "keys.bep")),
			};
		});
}
export function newAccountConfig(
	chain: "main" | "test",
	address: string,
): AccountConfig {
	return {
		chain,
		address,
		storageIdentityKey: `bsv-mcp-${randomBytes(16).toString("hex")}`,
		...(chain === "main" ? { activeRemote: DEFAULT_STORAGE_REMOTE_URL } : {}),
		depositPrefix: "mcp",
	};
}
