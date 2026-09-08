import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import {
	chmod,
	copyFile,
	lstat,
	mkdir,
	open,
	readFile,
	rename,
	rm,
	stat,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { HD, PrivateKey } from "@bsv/sdk";
import type { KeyStore } from "./keyManager";

export class EmbeddedVaultError extends Error {
	readonly code: string;
	constructor(code: string, message: string) {
		super(message);
		this.name = "EmbeddedVaultError";
		this.code = code;
	}
}

export interface EmbeddedVaultEntryReceipt {
	entryId: string;
	publicKey: string;
}

export interface EmbeddedVaultHdReceipt {
	entryId: string;
	expectedXpub: string;
}

/** Public receipt only. Never carries secrets. */
export interface EmbeddedVaultReceipt {
	vaultId: string;
	payment: EmbeddedVaultEntryReceipt;
	identity?: EmbeddedVaultEntryReceipt;
	hd?: EmbeddedVaultHdReceipt;
}

export interface EmbeddedVaultBinding {
	password: string;
	binding: EmbeddedVaultReceipt;
}

export interface EmbeddedVaultCreateInput {
	password: string;
	passwordConfirmation: string;
	label: string;
}

export interface EmbeddedVaultImportKeys {
	payPk: string;
	identityPk?: string;
	xprv?: string;
}

export interface EmbeddedVaultImportInput {
	password: string;
	passwordConfirmation?: string;
	label: string;
	keys: EmbeddedVaultImportKeys;
}

export interface EmbeddedVaultIoOptions {
	vaultPath: string;
	loadModule?: () => Promise<unknown>;
	now?: () => number;
}

export interface EmbeddedVaultIo {
	create(input: EmbeddedVaultCreateInput): Promise<EmbeddedVaultReceipt>;
	importKeys(input: EmbeddedVaultImportInput): Promise<EmbeddedVaultReceipt>;
	/** Returns trusted in-memory keys. Never serialize, log, or expose them. */
	unlock(input: EmbeddedVaultBinding): Promise<KeyStore>;
	/** Clears the held vault session. Cannot revoke already-returned keys. */
	lock(): void;
}

interface VaultEntryFull {
	id: string;
	kind: string;
	label: string;
	tags: string[];
	createdAt: string;
	updatedAt: string;
	value: string;
	publicKey?: string;
	[key: string]: unknown;
}

interface VaultHandle {
	toDocument(): {
		id: string;
		entries: VaultEntryFull[];
		settings: { revealEnabled: boolean };
	};
	list(): { id: string; kind: string; publicKey?: string }[];
	get(id: string): { id: string; kind: string; publicKey?: string };
	unlock(reason: string, ttlSeconds?: number): void;
	lock(): void;
	reveal(id: string, reason: string): string;
	generateKey(label: string): { id: string; kind: string; publicKey?: string };
	importPlain(
		payload: unknown,
		label: string,
	): { id: string; kind: string; publicKey?: string }[];
	adoptEntry(
		entry: VaultEntryFull,
		detail?: string,
	): { id: string; kind: string; publicKey?: string };
}

interface VaultModule {
	PassphraseProvider: new (passphrase: string) => unknown;
	createVault(
		path: string,
		providers: unknown[],
		settings?: { revealEnabled?: boolean },
	): Promise<VaultHandle>;
	openVault(path: string, provider: unknown): Promise<VaultHandle>;
	saveVault(path: string, vault: VaultHandle, provider: unknown): Promise<void>;
}

const MESSAGES = {
	INVALID_PATH: "The vault destination path is invalid.",
	INVALID_PASSWORD: "The vault password must be at least eight characters.",
	PASSWORD_MISMATCH: "The vault password confirmation does not match.",
	INVALID_LABEL: "The vault entry label is invalid.",
	INVALID_KEY: "One or more imported keys are invalid.",
	VAULT_EXISTS: "The vault destination already exists.",
	VAULT_BUSY: "The vault destination is busy.",
	UNLOCK_FAILED: "Cannot unlock the vault.",
	BINDING_MISMATCH: "The vault binding does not match.",
	REVEAL_DISABLED: "The vault does not allow key reveal.",
	VAULT_CHANGED: "The vault destination changed during the write.",
	WRITE_FAILED: "The vault write did not complete.",
	VAULT_PACKAGE_INCOMPATIBLE: "The installed vault package is unavailable.",
} as const;

type ErrorCode = keyof typeof MESSAGES;

const failure = (code: ErrorCode): EmbeddedVaultError =>
	new EmbeddedVaultError(code, MESSAGES[code]);

const COMPRESSED_PUBKEY = /^(02|03)[0-9a-fA-F]{64}$/;
const KEY_KINDS = new Set(["private", "wif"]);
const VERIFY_REASON = "Embedded vault verify";
const UNLOCK_REASON = "Embedded vault unlock";

const digest = (data: Uint8Array | string): string =>
	createHash("sha256").update(data).digest("hex");

function assertLabel(label: unknown): string {
	if (typeof label !== "string" || label.trim().length === 0)
		throw failure("INVALID_LABEL");
	return label;
}

function assertPassword(password: unknown): string {
	if (typeof password !== "string" || password.length < 8)
		throw failure("INVALID_PASSWORD");
	return password;
}

function assertConfirmation(password: string, confirmation: unknown): void {
	if (typeof confirmation !== "string" || confirmation !== password)
		throw failure("PASSWORD_MISMATCH");
}

interface ParsedKeys {
	payWif: string;
	payPub: string;
	identityWif?: string;
	identityPub?: string;
	xprv?: string;
	expectedXpub?: string;
	/** Compressed pubkey for the hd-private entry metadata. */
	hdPub?: string;
}

function parseKeys(keys: EmbeddedVaultImportKeys): ParsedKeys {
	if (!keys || typeof keys !== "object") throw failure("INVALID_KEY");
	let payPub: string;
	try {
		payPub = PrivateKey.fromWif(keys.payPk).toPublicKey().toString();
	} catch {
		throw failure("INVALID_KEY");
	}
	if (!COMPRESSED_PUBKEY.test(payPub)) throw failure("INVALID_KEY");
	const parsed: ParsedKeys = { payWif: keys.payPk, payPub };
	if (keys.identityPk !== undefined) {
		let identityPub: string;
		try {
			identityPub = PrivateKey.fromWif(keys.identityPk)
				.toPublicKey()
				.toString();
		} catch {
			throw failure("INVALID_KEY");
		}
		if (!COMPRESSED_PUBKEY.test(identityPub)) throw failure("INVALID_KEY");
		parsed.identityWif = keys.identityPk;
		parsed.identityPub = identityPub;
	}
	if (keys.xprv !== undefined) {
		let expectedXpub: string;
		let hdPub: string;
		try {
			const hd = HD.fromString(keys.xprv);
			if (!hd.isPrivate()) throw failure("INVALID_KEY");
			expectedXpub = hd.toPublic().toString();
			hdPub = hd.pubKey.toString();
		} catch (error) {
			if (error instanceof EmbeddedVaultError) throw error;
			throw failure("INVALID_KEY");
		}
		if (!COMPRESSED_PUBKEY.test(hdPub)) throw failure("INVALID_KEY");
		parsed.xprv = keys.xprv;
		parsed.expectedXpub = expectedXpub;
		parsed.hdPub = hdPub;
	}
	return parsed;
}

/** Resolve through the nearest existing ancestor. Rejects relative paths. */
function canonicalVaultPath(input: string): string {
	if (typeof input !== "string" || !isAbsolute(input))
		throw failure("INVALID_PATH");
	let parent = resolve(input);
	const tail: string[] = [];
	while (!existsSync(parent)) {
		const next = dirname(parent);
		if (next === parent) throw failure("INVALID_PATH");
		tail.unshift(basename(parent));
		parent = next;
	}
	let real: string;
	try {
		real = realpathSync(parent);
	} catch {
		throw failure("INVALID_PATH");
	}
	return join(real, ...tail);
}

/**
 * Reject symlink destination/ancestors and dangling links without following
 * them. Only existing components are examined; missing tail names are created
 * later under an examined parent.
 */
function assertNoSymlinks(resolvedInput: string): void {
	let cursor: string | undefined = resolvedInput;
	let previous = "";
	while (cursor !== undefined && cursor !== previous) {
		try {
			if (lstatSync(cursor).isSymbolicLink()) throw failure("INVALID_PATH");
		} catch (error) {
			if (error instanceof EmbeddedVaultError) throw error;
			if ((error as NodeJS.ErrnoException)?.code !== "ENOENT")
				throw failure("INVALID_PATH");
		}
		previous = cursor;
		const next = dirname(cursor);
		cursor = next === cursor ? undefined : next;
	}
}

async function syncFile(path: string): Promise<void> {
	const handle = await open(path, "r");
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

async function syncDirectory(path: string): Promise<void> {
	const handle = await open(path, "r");
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

async function loadVaultModule(
	loadModule: (() => Promise<unknown>) | undefined,
): Promise<VaultModule> {
	try {
		const candidate = await (loadModule ?? (() => import("@opl.dev/vault")))();
		if (
			candidate &&
			typeof candidate === "object" &&
			["PassphraseProvider", "createVault", "openVault", "saveVault"].every(
				(name) =>
					typeof (candidate as Record<string, unknown>)[name] === "function",
			)
		)
			return candidate as VaultModule;
	} catch {
		// Fall through to the fixed incompatibility error below.
	}
	throw failure("VAULT_PACKAGE_INCOMPATIBLE");
}

export function createEmbeddedVaultIo(
	options: EmbeddedVaultIoOptions,
): EmbeddedVaultIo {
	const now = options.now ?? Date.now;
	const requestedPath = options.vaultPath;
	const loadModule = options.loadModule;
	let held: VaultHandle | undefined;
	let epoch = 0;

	const asSafeWriteError = (error: unknown): EmbeddedVaultError =>
		error instanceof EmbeddedVaultError ? error : failure("WRITE_FAILED");

	const lockPrevious = (): void => {
		epoch += 1;
		if (!held) return;
		const previous = held;
		held = undefined;
		try {
			previous.lock();
		} catch {
			// The facade is revoked regardless of library cleanup state.
		}
	};

	const resolveCanonical = (): string => {
		const resolved = resolve(requestedPath);
		assertNoSymlinks(resolved);
		const canonical = canonicalVaultPath(requestedPath);
		assertNoSymlinks(canonical);
		return canonical;
	};

	interface WriteContext {
		stageDir: string;
		beforeBytes: Buffer | null;
		release: (outcome: "commit" | "abort" | "uncertain") => Promise<void>;
		/**
		 * Abort unless the sibling lock file is still owned (same inode/dev
		 * plus nonce). Checked immediately before the final revision/rename
		 * so a lock removed or replaced while staged crypto awaited cannot
		 * still commit. This narrows but does not eliminate the OS
		 * check-then-act window between the check and rename.
		 */
		assertOwned: () => Promise<void>;
	}

	/**
	 * Serialize writers with a sibling wx lock (mode 0600, no age/autosteal).
	 * The destination is only read after the lock is owned. Only an owned
	 * lock file (matching inode/dev plus nonce, never a symlink/replacement)
	 * is ever removed, and only an owned stage directory is ever removed.
	 */
	const withExclusiveWrite = async <T>(
		canonical: string,
		work: (ctx: WriteContext) => Promise<T>,
	): Promise<T> => {
		const lockPath = `${canonical}.lock`;
		const nonce = randomUUID();
		let lockHandle: Awaited<ReturnType<typeof open>> | undefined;
		try {
			lockHandle = await open(lockPath, "wx", 0o600);
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === "EEXIST")
				throw failure("VAULT_BUSY");
			throw failure("WRITE_FAILED");
		}
		let lockIno = -1;
		let lockDev = -1;
		try {
			const identity = await lockHandle.stat();
			lockIno = identity.ino;
			lockDev = identity.dev;
		} catch {
			try {
				await lockHandle.close();
			} catch {
				// Best-effort handle release.
			}
			lockHandle = undefined;
			throw failure("WRITE_FAILED");
		}
		const owned = async (): Promise<boolean> => {
			try {
				const link = await lstat(lockPath);
				if (link.isSymbolicLink() || !link.isFile()) return false;
				const current = await stat(lockPath);
				if (current.ino !== lockIno || current.dev !== lockDev) return false;
				const raw = await readFile(lockPath, "utf8");
				return (JSON.parse(raw) as { nonce?: unknown }).nonce === nonce;
			} catch {
				return false;
			}
		};
		const assertOwned = async (): Promise<void> => {
			if (!(await owned())) throw failure("VAULT_CHANGED");
		};
		const releaseLock = async (): Promise<void> => {
			try {
				await lockHandle?.close();
			} catch {
				// Continue to the ownership check below.
			} finally {
				lockHandle = undefined;
			}
			try {
				if (await owned()) await rm(lockPath);
			} catch {
				// Best-effort owned-lock removal; never throws raw errors.
			}
		};
		const stageDir = `${canonical}.stage-${randomUUID()}`;
		let stageOwned = false;
		let stageIno = -1;
		let stageDev = -1;
		const removeOwnedStage = async (): Promise<void> => {
			if (!stageOwned) return;
			try {
				const link = await lstat(stageDir);
				if (link.isSymbolicLink() || !link.isDirectory()) return;
				const current = await stat(stageDir);
				if (current.ino !== stageIno || current.dev !== stageDev) return;
				await rm(stageDir, { recursive: true, force: true });
			} catch {
				// Best-effort owned-stage removal; never throws raw errors.
			}
		};
		let settled = false;
		const release = async (
			outcome: "commit" | "abort" | "uncertain",
		): Promise<void> => {
			if (settled) return;
			settled = true;
			// Uncertain commits preserve encrypted recovery artifacts (the stage
			// directory and any retained backup); certain outcomes remove only
			// the owned stage directory. The lock is only removed when still
			// owned, so a replaced lock file is never deleted.
			try {
				if (outcome !== "uncertain") await removeOwnedStage();
			} catch {
				// Best-effort cleanup; settlement still proceeds to the lock.
			}
			await releaseLock();
		};
		try {
			try {
				await lockHandle.writeFile(
					JSON.stringify({ pid: process.pid, nonce, at: now() }),
				);
				await lockHandle.sync();
			} catch {
				throw failure("WRITE_FAILED");
			}
			let beforeBytes: Buffer | null = null;
			try {
				beforeBytes = existsSync(canonical) ? await readFile(canonical) : null;
			} catch {
				throw failure("WRITE_FAILED");
			}
			try {
				await mkdir(stageDir, { mode: 0o700 });
				await chmod(stageDir, 0o700);
				const identity = await stat(stageDir);
				stageIno = identity.ino;
				stageDev = identity.dev;
				stageOwned = true;
			} catch {
				throw failure("WRITE_FAILED");
			}
			return await work({ stageDir, beforeBytes, release, assertOwned });
		} catch (error) {
			if (!settled) {
				try {
					await release("abort");
				} catch {
					// Release is best-effort; report the original failure safely.
				}
			}
			throw asSafeWriteError(error);
		}
	};

	/**
	 * Reopen the encrypted stage with the real SDK and verify every receipt
	 * pin, kind, revealed secret, and rederived public key, plus byte-exact
	 * retention of every pre-existing entry. Never throws raw errors.
	 */
	const verifyStaged = async (params: {
		module: VaultModule;
		stagePath: string;
		password: string;
		vaultId: string | null;
		receipt: EmbeddedVaultReceipt;
		parsed: ParsedKeys | null;
		paymentHex: string | null;
		originals: VaultEntryFull[];
	}): Promise<string> => {
		let staged: VaultHandle | undefined;
		try {
			try {
				staged = await params.module.openVault(
					params.stagePath,
					new params.module.PassphraseProvider(params.password),
				);
			} catch {
				throw failure("WRITE_FAILED");
			}
			const active = staged;
			const document = active.toDocument();
			if (!document.settings.revealEnabled) throw failure("REVEAL_DISABLED");
			if (params.vaultId !== null && document.id !== params.vaultId)
				throw failure("VAULT_CHANGED");
			const byId = new Map(document.entries.map((entry) => [entry.id, entry]));
			const revealChecked = (entryId: string): string => {
				active.unlock(VERIFY_REASON, 30);
				try {
					return active.reveal(entryId, VERIFY_REASON);
				} catch {
					throw failure("VAULT_CHANGED");
				} finally {
					try {
						active.lock();
					} catch {
						// Verification sessions are always revoked.
					}
				}
			};
			const checkDirectEntry = (
				ref: EmbeddedVaultEntryReceipt,
				secret: string,
				isHex: boolean,
			): void => {
				const entry = byId.get(ref.entryId);
				if (!entry || !KEY_KINDS.has(entry.kind))
					throw failure("VAULT_CHANGED");
				if (
					typeof entry.publicKey !== "string" ||
					entry.publicKey.toLowerCase() !== ref.publicKey.toLowerCase()
				)
					throw failure("VAULT_CHANGED");
				const revealed = revealChecked(ref.entryId);
				if (revealed !== secret) throw failure("VAULT_CHANGED");
				let key: PrivateKey;
				try {
					key = isHex
						? PrivateKey.fromHex(revealed)
						: PrivateKey.fromWif(revealed);
				} catch {
					throw failure("VAULT_CHANGED");
				}
				if (
					key.toPublicKey().toString().toLowerCase() !==
					ref.publicKey.toLowerCase()
				)
					throw failure("VAULT_CHANGED");
			};
			checkDirectEntry(
				params.receipt.payment,
				params.parsed ? params.parsed.payWif : (params.paymentHex ?? ""),
				params.parsed === null,
			);
			if (params.receipt.identity)
				checkDirectEntry(
					params.receipt.identity,
					params.parsed?.identityWif ?? "",
					false,
				);
			if (params.receipt.hd) {
				const entry = byId.get(params.receipt.hd.entryId);
				if (entry?.kind !== "hd-private") throw failure("VAULT_CHANGED");
				if (
					typeof entry.publicKey !== "string" ||
					!COMPRESSED_PUBKEY.test(entry.publicKey)
				)
					throw failure("VAULT_CHANGED");
				const revealed = revealChecked(params.receipt.hd.entryId);
				if (revealed !== (params.parsed?.xprv ?? ""))
					throw failure("VAULT_CHANGED");
				let xpub: string;
				let hdPub: string;
				let isPrivate = false;
				try {
					const hd = HD.fromString(revealed);
					isPrivate = hd.isPrivate();
					xpub = hd.toPublic().toString();
					hdPub = hd.pubKey.toString();
				} catch {
					throw failure("VAULT_CHANGED");
				}
				if (!isPrivate) throw failure("VAULT_CHANGED");
				// Receipt pins the extended public key exactly (case-sensitive,
				// carries chaincode/version/depth); entry metadata pins the
				// compressed pubkey verified separately.
				if (xpub !== params.receipt.hd.expectedXpub)
					throw failure("VAULT_CHANGED");
				if (hdPub.toLowerCase() !== entry.publicKey.toLowerCase())
					throw failure("VAULT_CHANGED");
				if (
					params.parsed?.hdPub !== undefined &&
					hdPub.toLowerCase() !== params.parsed.hdPub.toLowerCase()
				)
					throw failure("VAULT_CHANGED");
			}
			for (const original of params.originals) {
				const current = byId.get(original.id);
				if (!current || JSON.stringify(current) !== JSON.stringify(original))
					throw failure("VAULT_CHANGED");
			}
			return document.id;
		} catch (error) {
			if (error instanceof EmbeddedVaultError) throw error;
			throw failure("WRITE_FAILED");
		} finally {
			try {
				staged?.lock();
			} catch {
				// Verification handles are always revoked.
			}
		}
	};

	/**
	 * Retain the encrypted original (existing only, never plaintext), re-check
	 * the destination revision, then atomically activate the fsynced stage.
	 * A parent-directory fsync failure after rename leaves durability
	 * uncertain, so it reports WRITE_FAILED with recovery artifacts preserved
	 * instead of false success. Never rolls back blindly and never throws raw
	 * filesystem errors.
	 */
	const commitStage = async (params: {
		stagePath: string;
		stageDir: string;
		canonical: string;
		beforeBytes: Buffer | null;
		release: WriteContext["release"];
		assertOwned: WriteContext["assertOwned"];
	}): Promise<void> => {
		const { stagePath, canonical, beforeBytes, release, assertOwned } = params;
		const uncertain = async (code: ErrorCode): Promise<never> => {
			try {
				await release("uncertain");
			} catch {
				// Settlement is best-effort; report the commit failure safely.
			}
			throw failure(code);
		};
		// Reject symlink/directory replacement of the destination or its
		// parent before the final read and rename.
		try {
			assertNoSymlinks(resolve(canonical));
			assertNoSymlinks(canonical);
			const parentLink = await lstat(dirname(canonical));
			if (parentLink.isSymbolicLink() || !parentLink.isDirectory())
				throw failure("VAULT_CHANGED");
			if (existsSync(canonical)) {
				const destLink = await lstat(canonical);
				if (destLink.isSymbolicLink() || !destLink.isFile())
					throw failure("VAULT_CHANGED");
			}
		} catch (error) {
			if (error instanceof EmbeddedVaultError)
				return await uncertain(
					error.code === "INVALID_PATH"
						? "VAULT_CHANGED"
						: (error.code as ErrorCode),
				);
			return await uncertain("WRITE_FAILED");
		}
		if (beforeBytes) {
			const backupPath = `${canonical}.backup-${randomUUID()}.bep`;
			let backupHandle: Awaited<ReturnType<typeof open>> | undefined;
			try {
				backupHandle = await open(backupPath, "wx", 0o600);
				await backupHandle.writeFile(beforeBytes);
				await backupHandle.sync();
			} catch {
				throw failure("WRITE_FAILED");
			} finally {
				try {
					await backupHandle?.close();
				} catch {
					// The backup handle is best-effort released.
				}
			}
			try {
				await chmod(backupPath, 0o600);
			} catch {
				throw failure("WRITE_FAILED");
			}
		}
		try {
			await syncFile(stagePath);
		} catch {
			throw failure("WRITE_FAILED");
		}
		let actual: Buffer | null = null;
		try {
			actual = existsSync(canonical) ? await readFile(canonical) : null;
		} catch {
			throw failure("WRITE_FAILED");
		}
		if (
			(actual === null) !== (beforeBytes === null) ||
			(actual !== null &&
				beforeBytes !== null &&
				digest(actual) !== digest(beforeBytes))
		) {
			await release("uncertain");
			throw failure("VAULT_CHANGED");
		}
		// Require exclusive-lock ownership immediately before the final
		// rename. A lock removed or replaced while staged crypto awaited
		// aborts here with recovery artifacts preserved (the replaced lock
		// is never removed). This narrows but does not eliminate the OS
		// check-then-act window between this check and rename.
		try {
			await assertOwned();
		} catch (error) {
			if (error instanceof EmbeddedVaultError)
				return await uncertain(error.code as ErrorCode);
			return await uncertain("WRITE_FAILED");
		}
		try {
			await rename(stagePath, canonical);
		} catch {
			return await uncertain("WRITE_FAILED");
		}
		try {
			await syncDirectory(dirname(canonical));
		} catch {
			// The rename completed but its durability is uncertain: preserve
			// owned recovery artifacts and report failure, never false success.
			// The activated destination is left in place; no blind rollback.
			return await uncertain("WRITE_FAILED");
		}
		try {
			await release("commit");
		} catch {
			throw failure("WRITE_FAILED");
		}
	};

	return {
		async create(
			input: EmbeddedVaultCreateInput,
		): Promise<EmbeddedVaultReceipt> {
			const password = assertPassword(input?.password);
			assertConfirmation(password, input?.passwordConfirmation);
			const label = assertLabel(input?.label);
			const module = await loadVaultModule(loadModule);
			const canonical = resolveCanonical();
			try {
				await mkdir(dirname(canonical), { recursive: true, mode: 0o700 });
			} catch {
				throw failure("WRITE_FAILED");
			}
			return await withExclusiveWrite(canonical, async (ctx) => {
				if (ctx.beforeBytes !== null) {
					try {
						await ctx.release("abort");
					} catch {
						throw failure("WRITE_FAILED");
					}
					throw failure("VAULT_EXISTS");
				}
				const stagePath = join(ctx.stageDir, "vault.bep");
				const provider = new module.PassphraseProvider(password);
				let vault: VaultHandle | undefined;
				let paymentId = "";
				try {
					vault = await module.createVault(stagePath, [provider], {
						revealEnabled: true,
					});
					const payment = vault.generateKey(label);
					paymentId = payment.id;
					await module.saveVault(stagePath, vault, provider);
				} catch (error) {
					if (error instanceof EmbeddedVaultError) throw error;
					throw failure("WRITE_FAILED");
				} finally {
					try {
						vault?.lock();
					} catch {
						// Staging handles are always revoked.
					}
				}
				// Read the staged payment pin before full verification.
				let staged: VaultHandle | undefined;
				let paymentHex = "";
				let stagedVaultId = "";
				try {
					try {
						staged = await module.openVault(
							stagePath,
							new module.PassphraseProvider(password),
						);
					} catch {
						throw failure("WRITE_FAILED");
					}
					const entry = staged.get(paymentId);
					if (
						entry.kind !== "private" ||
						typeof entry.publicKey !== "string" ||
						!COMPRESSED_PUBKEY.test(entry.publicKey)
					)
						throw failure("VAULT_CHANGED");
					staged.unlock(VERIFY_REASON, 30);
					try {
						paymentHex = staged.reveal(paymentId, VERIFY_REASON);
					} finally {
						staged.lock();
					}
					const publicKey = PrivateKey.fromHex(paymentHex)
						.toPublicKey()
						.toString();
					if (publicKey.toLowerCase() !== entry.publicKey.toLowerCase())
						throw failure("VAULT_CHANGED");
					stagedVaultId = staged.toDocument().id;
					const receipt: EmbeddedVaultReceipt = {
						vaultId: stagedVaultId,
						payment: { entryId: paymentId, publicKey },
					};
					const verifiedId = await verifyStaged({
						module,
						stagePath,
						password,
						vaultId: stagedVaultId,
						receipt,
						parsed: null,
						paymentHex,
						originals: [],
					});
					receipt.vaultId = verifiedId;
					await commitStage({
						stagePath,
						stageDir: ctx.stageDir,
						canonical,
						beforeBytes: ctx.beforeBytes,
						release: ctx.release,
						assertOwned: ctx.assertOwned,
					});
					return receipt;
				} catch (error) {
					if (error instanceof EmbeddedVaultError) throw error;
					throw failure("WRITE_FAILED");
				} finally {
					try {
						staged?.lock();
					} catch {
						// Verification handles are always revoked.
					}
				}
			});
		},

		async importKeys(
			input: EmbeddedVaultImportInput,
		): Promise<EmbeddedVaultReceipt> {
			const label = assertLabel(input?.label);
			const parsed = parseKeys(input?.keys ?? ({} as EmbeddedVaultImportKeys));
			const passwordCandidate = input?.password;
			if (typeof passwordCandidate !== "string" || !passwordCandidate)
				throw failure("INVALID_PASSWORD");
			// Fresh destinations require confirmation before any write, so
			// enforce it pre-lock on the best-effort existence probe. The
			// authoritative check still runs under the exclusive lock.
			const probeResolved = resolve(requestedPath);
			assertNoSymlinks(probeResolved);
			if (!existsSync(canonicalVaultPath(requestedPath))) {
				assertPassword(passwordCandidate);
				assertConfirmation(passwordCandidate, input?.passwordConfirmation);
			}
			const module = await loadVaultModule(loadModule);
			const canonical = resolveCanonical();
			try {
				await mkdir(dirname(canonical), { recursive: true, mode: 0o700 });
			} catch {
				throw failure("WRITE_FAILED");
			}
			return await withExclusiveWrite(canonical, async (ctx) => {
				const password = passwordCandidate;
				const fresh = ctx.beforeBytes === null;
				if (fresh) {
					assertPassword(password);
					assertConfirmation(password, input?.passwordConfirmation);
				}
				const stagePath = join(ctx.stageDir, "vault.bep");
				const provider = new module.PassphraseProvider(password);
				let vault: VaultHandle | undefined;
				let originals: VaultEntryFull[] = [];
				let vaultId: string | null = null;
				let paymentId = "";
				let identityId: string | undefined;
				let hdId: string | undefined;
				try {
					if (fresh) {
						try {
							vault = await module.createVault(stagePath, [provider], {
								revealEnabled: true,
							});
						} catch {
							throw failure("WRITE_FAILED");
						}
					} else {
						try {
							await copyFile(canonical, stagePath);
							await chmod(stagePath, 0o600);
						} catch {
							throw failure("WRITE_FAILED");
						}
						try {
							vault = await module.openVault(stagePath, provider);
						} catch {
							throw failure("UNLOCK_FAILED");
						}
						if (!vault.toDocument().settings.revealEnabled)
							throw failure("REVEAL_DISABLED");
						originals = structuredClone(
							vault.toDocument().entries,
						) as VaultEntryFull[];
						vaultId = vault.toDocument().id;
					}
					const active = vault;
					const payment = active.importPlain(
						{ wif: parsed.payWif },
						`${label} payment`,
					)[0];
					if (!payment) throw failure("WRITE_FAILED");
					paymentId = payment.id;
					if (parsed.identityWif !== undefined) {
						const identity = active.importPlain(
							{ wif: parsed.identityWif },
							`${label} identity`,
						)[0];
						if (!identity) throw failure("WRITE_FAILED");
						identityId = identity.id;
					}
					if (parsed.xprv !== undefined) {
						const at = new Date(now()).toISOString();
						const adopted = active.adoptEntry(
							{
								id: randomUUID(),
								kind: "hd-private",
								label: `${label} hd`,
								tags: [],
								createdAt: at,
								updatedAt: at,
								value: parsed.xprv,
								publicKey: parsed.hdPub ?? parsed.expectedXpub,
								metadata: {},
							},
							"Import retained HD key",
						);
						if (!adopted) throw failure("WRITE_FAILED");
						hdId = adopted.id;
					}
					try {
						await module.saveVault(stagePath, active, provider);
					} catch {
						throw failure("WRITE_FAILED");
					}
				} catch (error) {
					if (error instanceof EmbeddedVaultError) throw error;
					throw failure("WRITE_FAILED");
				} finally {
					try {
						vault?.lock();
					} catch {
						// Staging handles are always revoked.
					}
				}
				const receipt: EmbeddedVaultReceipt = {
					vaultId: vaultId ?? "",
					payment: { entryId: paymentId, publicKey: parsed.payPub },
					...(identityId !== undefined && parsed.identityPub !== undefined
						? {
								identity: {
									entryId: identityId,
									publicKey: parsed.identityPub,
								},
							}
						: {}),
					...(hdId !== undefined && parsed.expectedXpub !== undefined
						? {
								hd: { entryId: hdId, expectedXpub: parsed.expectedXpub },
							}
						: {}),
				};
				receipt.vaultId = await verifyStaged({
					module,
					stagePath,
					password,
					vaultId,
					receipt,
					parsed,
					paymentHex: null,
					originals,
				});
				await commitStage({
					stagePath,
					stageDir: ctx.stageDir,
					canonical,
					beforeBytes: ctx.beforeBytes,
					release: ctx.release,
					assertOwned: ctx.assertOwned,
				});
				return receipt;
			});
		},

		async unlock(input: EmbeddedVaultBinding): Promise<KeyStore> {
			lockPrevious();
			const myEpoch = epoch;
			const password = input?.password;
			const binding = input?.binding;
			if (
				typeof password !== "string" ||
				!password ||
				!binding ||
				typeof binding !== "object" ||
				typeof binding.vaultId !== "string" ||
				!binding.payment ||
				typeof binding.payment !== "object" ||
				typeof binding.payment.entryId !== "string" ||
				typeof binding.payment.publicKey !== "string"
			)
				throw failure("BINDING_MISMATCH");
			// Snapshot every nested binding property before the first await so
			// a caller mutating input.binding while the loader is held cannot
			// redirect the unlock to a different vault root or entry.
			const pinnedPayment: EmbeddedVaultEntryReceipt = {
				entryId: binding.payment.entryId,
				publicKey: binding.payment.publicKey,
			};
			let pinnedIdentity: EmbeddedVaultEntryReceipt | undefined;
			if (binding.identity !== undefined) {
				const candidate = binding.identity as EmbeddedVaultEntryReceipt;
				if (
					!candidate ||
					typeof candidate !== "object" ||
					typeof candidate.entryId !== "string" ||
					typeof candidate.publicKey !== "string"
				)
					throw failure("BINDING_MISMATCH");
				pinnedIdentity = {
					entryId: candidate.entryId,
					publicKey: candidate.publicKey,
				};
			}
			let pinnedHd: EmbeddedVaultHdReceipt | undefined;
			if (binding.hd !== undefined) {
				const candidate = binding.hd as EmbeddedVaultHdReceipt;
				if (
					!candidate ||
					typeof candidate !== "object" ||
					typeof candidate.entryId !== "string" ||
					typeof candidate.expectedXpub !== "string" ||
					candidate.expectedXpub.length === 0
				)
					throw failure("BINDING_MISMATCH");
				pinnedHd = {
					entryId: candidate.entryId,
					expectedXpub: candidate.expectedXpub,
				};
			}
			const pinned: EmbeddedVaultReceipt = {
				vaultId: binding.vaultId,
				payment: pinnedPayment,
				...(pinnedIdentity !== undefined ? { identity: pinnedIdentity } : {}),
				...(pinnedHd !== undefined ? { hd: pinnedHd } : {}),
			};
			const module = await loadVaultModule(loadModule);
			const canonical = resolveCanonical();
			let vault: VaultHandle | undefined;
			try {
				try {
					vault = await module.openVault(
						canonical,
						new module.PassphraseProvider(password),
					);
				} catch {
					throw failure("UNLOCK_FAILED");
				}
				const active = vault;
				try {
					if (active.toDocument().id !== pinned.vaultId)
						throw failure("BINDING_MISMATCH");
					if (!active.toDocument().settings.revealEnabled)
						throw failure("REVEAL_DISABLED");
					const readDirectKey = (
						ref: EmbeddedVaultEntryReceipt,
					): PrivateKey => {
						let entry: { kind: string; publicKey?: string };
						try {
							entry = active.get(ref.entryId);
						} catch {
							throw failure("BINDING_MISMATCH");
						}
						if (!KEY_KINDS.has(entry.kind)) throw failure("BINDING_MISMATCH");
						if (
							typeof entry.publicKey !== "string" ||
							!COMPRESSED_PUBKEY.test(ref.publicKey) ||
							entry.publicKey.toLowerCase() !== ref.publicKey.toLowerCase()
						)
							throw failure("BINDING_MISMATCH");
						let revealed: string;
						try {
							revealed = active.reveal(ref.entryId, UNLOCK_REASON);
						} catch {
							throw failure("BINDING_MISMATCH");
						}
						let key: PrivateKey;
						try {
							key =
								entry.kind === "private"
									? PrivateKey.fromHex(revealed)
									: PrivateKey.fromWif(revealed);
						} catch {
							throw failure("BINDING_MISMATCH");
						}
						if (
							key.toPublicKey().toString().toLowerCase() !==
							ref.publicKey.toLowerCase()
						)
							throw failure("BINDING_MISMATCH");
						return key;
					};
					const payPk = readDirectKey(pinned.payment);
					let identityPk: PrivateKey | undefined;
					if (pinned.identity !== undefined)
						identityPk = readDirectKey(pinned.identity);
					let xprv: string | undefined;
					if (pinned.hd !== undefined) {
						let entry: { kind: string; publicKey?: string };
						try {
							entry = active.get(pinned.hd.entryId);
						} catch {
							throw failure("BINDING_MISMATCH");
						}
						if (entry.kind !== "hd-private") throw failure("BINDING_MISMATCH");
						if (
							typeof entry.publicKey !== "string" ||
							!COMPRESSED_PUBKEY.test(entry.publicKey) ||
							typeof pinned.hd.expectedXpub !== "string" ||
							pinned.hd.expectedXpub.length === 0
						)
							throw failure("BINDING_MISMATCH");
						let revealed: string;
						try {
							revealed = active.reveal(pinned.hd.entryId, UNLOCK_REASON);
						} catch {
							throw failure("BINDING_MISMATCH");
						}
						let xpub: string;
						let hdPub: string;
						let isPrivate = false;
						try {
							const hd = HD.fromString(revealed);
							isPrivate = hd.isPrivate();
							xpub = hd.toPublic().toString();
							hdPub = hd.pubKey.toString();
						} catch {
							throw failure("BINDING_MISMATCH");
						}
						if (!isPrivate) throw failure("BINDING_MISMATCH");
						if (xpub !== pinned.hd.expectedXpub)
							throw failure("BINDING_MISMATCH");
						if (hdPub.toLowerCase() !== entry.publicKey.toLowerCase())
							throw failure("BINDING_MISMATCH");
						xprv = revealed;
					}
					if (myEpoch !== epoch) {
						try {
							active.lock();
						} catch {
							// Late sessions are always revoked.
						}
						throw failure("UNLOCK_FAILED");
					}
					held = active;
					vault = undefined;
					const result: KeyStore = { payPk };
					if (identityPk !== undefined) result.identityPk = identityPk;
					if (xprv !== undefined) result.xprv = xprv;
					return result;
				} catch (error) {
					try {
						active.lock();
					} catch {
						// Failed verification always revokes the library session.
					}
					throw error;
				}
			} catch (error) {
				if (vault) {
					try {
						vault.lock();
					} catch {
						// Failed verification always revokes the library session.
					}
				}
				if (error instanceof EmbeddedVaultError) throw error;
				throw failure("UNLOCK_FAILED");
			}
		},

		lock(): void {
			lockPrevious();
		},
	};
}
