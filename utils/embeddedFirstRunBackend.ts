import { randomUUID } from "node:crypto";
import { existsSync, constants as fsConstants, lstatSync } from "node:fs";
import { chmod, mkdir, open, readFile, rm } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { PrivateKey } from "@bsv/sdk";
import {
	accountNameSchema,
	accountsRoot,
	type EmbeddedVaultBinding,
	embeddedVaultBindingSchema,
	newAccountConfig,
	writeAccount,
} from "./accounts";
import { createEmbeddedVaultIo, EmbeddedVaultError } from "./embeddedVaultIo";

export class EmbeddedFirstRunError extends Error {
	readonly code: string;
	constructor(code: string, message: string) {
		super(message);
		this.name = "EmbeddedFirstRunError";
		this.code = code;
	}
}

export const EMBEDDED_FIRST_RUN_CODES = {
	CONFIRMATION_REQUIRED: "EMBEDDED_FIRST_RUN_CONFIRMATION_REQUIRED",
	ACCOUNT_EXISTS: "EMBEDDED_FIRST_RUN_ACCOUNT_EXISTS",
	BUSY: "EMBEDDED_FIRST_RUN_BUSY",
	FAILED: "EMBEDDED_FIRST_RUN_FAILED",
} as const;

const MESSAGES = {
	CONFIRMATION_REQUIRED: "A confirmed first-run creation is required.",
	ACCOUNT_EXISTS: "The selected account already exists.",
	BUSY: "The selected account is busy.",
	FAILED:
		"Could not create your wallet. Check your existing Vault password, if you have one, and try again.",
} as const;

type ShortCode = keyof typeof MESSAGES;

const fail = (code: ShortCode): EmbeddedFirstRunError =>
	new EmbeddedFirstRunError(EMBEDDED_FIRST_RUN_CODES[code], MESSAGES[code]);

export const FIRST_RUN_CONFIRMATION = "CREATE_NEW_CONFIRMED" as const;

export interface EmbeddedFirstRunBackendOptions {
	vaultPath: string;
	accountsDirectory?: string;
	/** Chain for the derived address. Defaults to "main". */
	chain?: "main" | "test";
	/**
	 * Narrow test-only seam for the account writer. The default is the real
	 * `writeAccount`. The Vault path always uses the real
	 * `createEmbeddedVaultIo` and is never injected.
	 */
	writeAccountImpl?: typeof writeAccount;
}

export interface EmbeddedFirstRunCreateInput {
	accountName: string;
	password: string;
	passwordConfirmation: string;
	confirmation: "CREATE_NEW_CONFIRMED";
}

export interface EmbeddedFirstRunResult {
	accountName: string;
	address: string;
	/**
	 * Exact public binding already persisted in config. The root can complete
	 * the wizard in-process via
	 * `createEmbeddedVaultIo({ vaultPath }).unlock({ password, binding:
	 * result.vaultBinding })` and adopt the active wallet/session immediately.
	 * Contains only public vaultId/entry IDs/public keys/xpub. Never carries
	 * password, WIF, xprv, raw receipt secrets, or paths.
	 */
	vaultBinding: EmbeddedVaultBinding;
}

export interface EmbeddedFirstRunBackend {
	create(input: EmbeddedFirstRunCreateInput): Promise<EmbeddedFirstRunResult>;
}

const MIN_PASSWORD_LENGTH = 8;

function lockPathFor(accountsDirectory: string, accountName: string): string {
	return join(accountsDirectory, `.${accountName}.first-run.lock`);
}

function accountPathFor(
	accountsDirectory: string,
	accountName: string,
): string {
	return join(accountsDirectory, accountName);
}

/**
 * Embedded Vault first-run service. Acquires an exclusive per-account
 * reservation, creates a fresh Vault or appends a new payment key to an
 * existing Vault, verifies the new payment secret through unlock, then
 * persists encrypted Vault-backed config metadata. Never overwrites an
 * existing account and never deletes a Vault.
 */
export function createEmbeddedFirstRunBackend(
	options: EmbeddedFirstRunBackendOptions,
): EmbeddedFirstRunBackend {
	const requestedVaultPath = options?.vaultPath;
	const requestedAccountsDirectory = options?.accountsDirectory;
	const requestedChain = options?.chain ?? "main";
	const writeAccountImpl = options?.writeAccountImpl ?? writeAccount;
	if (
		typeof requestedVaultPath !== "string" ||
		!isAbsolute(requestedVaultPath)
	) {
		throw fail("FAILED");
	}
	if (
		requestedAccountsDirectory !== undefined &&
		(typeof requestedAccountsDirectory !== "string" ||
			!isAbsolute(requestedAccountsDirectory))
	) {
		throw fail("FAILED");
	}
	if (requestedChain !== "main" && requestedChain !== "test") {
		throw fail("FAILED");
	}
	const vaultPath = requestedVaultPath;
	const chain = requestedChain;

	const resolveAccountsDirectory = (): string =>
		requestedAccountsDirectory ?? accountsRoot();

	/**
	 * Validate everything that can be checked without touching the disk, so
	 * invalid input never produces locks, Vault files, or account writes.
	 * No secret or path value ever enters a thrown message.
	 */
	const validateInput = (
		input: EmbeddedFirstRunCreateInput,
	): { name: string; password: string } => {
		if (!input || typeof input !== "object") throw fail("FAILED");
		if (input.confirmation !== FIRST_RUN_CONFIRMATION)
			throw fail("CONFIRMATION_REQUIRED");
		if (!accountNameSchema.safeParse(input.accountName).success)
			throw fail("FAILED");
		const name = input.accountName;
		if (
			typeof input.password !== "string" ||
			input.password.length < MIN_PASSWORD_LENGTH
		)
			throw fail("FAILED");
		if (input.passwordConfirmation !== input.password) throw fail("FAILED");
		return { name, password: input.password };
	};

	const mapVaultError = (error: unknown): EmbeddedFirstRunError => {
		if (error instanceof EmbeddedFirstRunError) return error;
		if (error instanceof EmbeddedVaultError) {
			if (error.code === "VAULT_BUSY") return fail("BUSY");
		}
		return fail("FAILED");
	};

	/**
	 * Serialize first-run creators per account with a create-exclusive lock
	 * file (O_EXCL | O_NOFOLLOW, mode 0600, no age-based steal). Only the
	 * exact lock acquired by this invocation is ever removed: the open file
	 * identity (dev/ino) captured at creation must still match the path, and
	 * the nonce must match. A removed/replaced/foreign lock is never deleted.
	 */
	const withReservation = async <T>(
		accountsDirectory: string,
		name: string,
		work: () => Promise<T>,
	): Promise<T> => {
		const lockPath = lockPathFor(accountsDirectory, name);
		try {
			lstatSync(lockPath);
			throw fail("BUSY");
		} catch (error) {
			if (error instanceof EmbeddedFirstRunError) throw error;
			if ((error as NodeJS.ErrnoException)?.code !== "ENOENT")
				throw fail("BUSY");
		}
		const nonce = randomUUID();
		let lockHandle: Awaited<ReturnType<typeof open>> | undefined;
		let heldDev: number | undefined;
		let heldIno: number | undefined;
		try {
			lockHandle = await open(
				lockPath,
				fsConstants.O_WRONLY |
					fsConstants.O_CREAT |
					fsConstants.O_EXCL |
					fsConstants.O_NOFOLLOW,
				0o600,
			);
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === "EEXIST")
				throw fail("BUSY");
			throw fail("FAILED");
		}
		const owned = async (): Promise<boolean> => {
			try {
				const raw = await readFile(lockPath, "utf8");
				return (JSON.parse(raw) as { nonce?: unknown }).nonce === nonce;
			} catch {
				return false;
			}
		};
		const sameFile = (): boolean => {
			if (heldDev === undefined || heldIno === undefined) return true;
			try {
				const current = lstatSync(lockPath);
				return current.dev === heldDev && current.ino === heldIno;
			} catch {
				// Removed path (or unreadable identity): never delete.
				return false;
			}
		};
		const release = async (): Promise<void> => {
			try {
				await lockHandle?.close();
			} catch {
				// Continue to the identity/ownership checks below.
			} finally {
				lockHandle = undefined;
			}
			try {
				if (!sameFile()) return;
				if (await owned()) await rm(lockPath, { force: true });
			} catch {
				// Cleanup is best-effort and must never mask the work outcome.
			}
		};
		try {
			await lockHandle.writeFile(JSON.stringify({ pid: process.pid, nonce }));
			const handle = lockHandle;
			try {
				await handle.sync();
			} catch {
				// Fsync is best-effort on platforms that do not support it.
			}
			try {
				const heldStat = await handle.stat();
				heldDev = heldStat.dev;
				heldIno = heldStat.ino;
			} catch {
				// Identity unavailable: release falls back to the nonce check.
			}
			return await work();
		} finally {
			await release();
		}
	};

	const assertAccountAbsent = (
		accountsDirectory: string,
		name: string,
	): void => {
		try {
			// Any existing entry (directory, file, symlink, or otherwise)
			// refuses the create. The account must never be overwritten.
			lstatSync(accountPathFor(accountsDirectory, name));
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return;
			throw fail("FAILED");
		}
		throw fail("ACCOUNT_EXISTS");
	};

	const create = async (
		input: EmbeddedFirstRunCreateInput,
	): Promise<EmbeddedFirstRunResult> => {
		const { name, password } = validateInput(input);
		const accountsDirectory = resolveAccountsDirectory();
		try {
			await mkdir(accountsDirectory, { recursive: true, mode: 0o700 });
			await chmod(accountsDirectory, 0o700);
		} catch {
			throw fail("FAILED");
		}
		return await withReservation(accountsDirectory, name, async () => {
			assertAccountAbsent(accountsDirectory, name);
			const io = createEmbeddedVaultIo({ vaultPath });
			try {
				let receipt: Awaited<ReturnType<typeof io.create>>;
				const label = `${name} payment`;
				const importPayment = async (): Promise<
					Awaited<ReturnType<typeof io.create>>
				> => {
					const payWif = PrivateKey.fromRandom().toWif();
					return io.importKeys({
						password,
						label,
						keys: { payPk: payWif },
					});
				};
				try {
					if (existsSync(vaultPath)) {
						// Existing Vaults are append-only: import a newly-generated
						// payment key under the supplied Vault password.
						receipt = await importPayment();
					} else {
						try {
							receipt = await io.create({
								password,
								passwordConfirmation: input.passwordConfirmation,
								label,
							});
						} catch (error) {
							// Another creator may have committed a Vault between the
							// existence probe and create. Retry as an append in that case.
							if (
								!(error instanceof EmbeddedVaultError) ||
								error.code !== "VAULT_EXISTS"
							)
								throw error;
							receipt = await importPayment();
						}
					}
				} catch (error) {
					throw mapVaultError(error);
				}
				const binding = embeddedVaultBindingSchema.safeParse({
					version: 1,
					contract: "embedded-roots-v1",
					vaultId: receipt.vaultId,
					payment: receipt.payment,
					...(receipt.identity !== undefined
						? { identity: receipt.identity }
						: {}),
					...(receipt.hd !== undefined ? { hd: receipt.hd } : {}),
				});
				if (!binding.success) throw fail("FAILED");
				let keys: Awaited<ReturnType<typeof io.unlock>>;
				try {
					// Verify the exact public binding persisted/returned below.
					keys = await io.unlock({ password, binding: binding.data });
				} catch (error) {
					throw mapVaultError(error);
				}
				let address: string;
				try {
					const payPk = keys.payPk;
					if (!(payPk instanceof PrivateKey)) throw fail("FAILED");
					if (
						payPk.toPublicKey().toString().toLowerCase() !==
						binding.data.payment.publicKey.toLowerCase()
					)
						throw fail("FAILED");
					address = payPk.toAddress(chain === "test" ? [0x6f] : [0x00]);
				} catch (error) {
					throw mapVaultError(error);
				}
				const config = newAccountConfig(chain, address);
				config.vaultBinding = binding.data;
				try {
					writeAccountImpl(name, config, accountsDirectory, {
						expectedRevision: null,
					});
				} catch {
					// The newly-created Vault and its encrypted recovery data stay
					// intact; a failed account write never rolls the Vault back.
					throw fail("FAILED");
				}
				return {
					accountName: name,
					address,
					vaultBinding: binding.data,
				};
			} finally {
				// Covers create, receipt mapping, unlock/SDK verification, and
				// persistence failures. Clears the per-call Vault session.
				io.lock();
			}
		});
	};

	return { create };
}
