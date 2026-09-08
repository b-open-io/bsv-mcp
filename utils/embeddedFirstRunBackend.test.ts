import { expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	accountDir,
	embeddedVaultBindingSchema,
	readAccount,
	writeAccount,
} from "./accounts";
import {
	createEmbeddedFirstRunBackend,
	EmbeddedFirstRunError,
} from "./embeddedFirstRunBackend";
import { createEmbeddedVaultIo } from "./embeddedVaultIo";

const PASSWORD = "correct-horse-battery-1";
const OTHER_PASSWORD = "another-horse-battery-2";

/** Canonicalized mkdtemp root: macOS tmpdir lives under a symlinked /var. */
function tempRoot(prefix: string): string {
	return realpathSync(mkdtempSync(join(tmpdir(), prefix)));
}

function lockName(name: string): string {
	return `.${name}.first-run.lock`;
}

async function expectRejectCode(
	promise: Promise<unknown>,
	code: string,
): Promise<Error> {
	const outcome = await promise.then(
		() => ({ fulfilled: true as const }),
		(error: unknown) => ({ fulfilled: false as const, error }),
	);
	if (outcome.fulfilled) throw new Error(`Expected rejection with ${code}`);
	expect((outcome.error as { code?: string }).code).toBe(code);
	expect(outcome.error).toBeInstanceOf(EmbeddedFirstRunError);
	return outcome.error as Error;
}

test("fresh create with default chain produces mainnet vault-backed account", async () => {
	const root = tempRoot("bsv-first-run-main-");
	try {
		const vaultPath = join(root, "vault.bep");
		const accountsDir = join(root, "accounts");
		const backend = createEmbeddedFirstRunBackend({
			vaultPath,
			accountsDirectory: accountsDir,
		});
		const result = await backend.create({
			accountName: "alice",
			password: PASSWORD,
			passwordConfirmation: PASSWORD,
			confirmation: "CREATE_NEW_CONFIRMED",
		});
		expect(Object.keys(result).sort()).toEqual([
			"accountName",
			"address",
			"vaultBinding",
		]);
		expect(result).toEqual({
			accountName: "alice",
			address: result.address,
			vaultBinding: result.vaultBinding,
		});
		expect(result.address.startsWith("1")).toBe(true);
		expect(existsSync(vaultPath)).toBe(true);
		expect(readFileSync(vaultPath).length).toBeGreaterThan(0);
		const config = readAccount("alice", accountsDir);
		expect(config?.address).toBe(result.address);
		expect(config?.chain).toBe("main");
		const binding = config?.vaultBinding;
		if (!binding) throw new Error("Expected persisted vault binding");
		expect(embeddedVaultBindingSchema.parse(binding)).toEqual(binding);
		// The trusted result carries the exact public binding persisted above.
		expect(embeddedVaultBindingSchema.parse(result.vaultBinding)).toEqual(
			result.vaultBinding,
		);
		expect(result.vaultBinding).toEqual(binding);
		expect(Object.keys(binding).sort()).toEqual([
			"contract",
			"payment",
			"vaultId",
			"version",
		]);
		expect(binding.version).toBe(1);
		expect(binding.contract).toBe("embedded-roots-v1");
		const dir = accountDir("alice", accountsDir);
		expect(existsSync(join(dir, "config.json"))).toBe(true);
		expect(existsSync(join(dir, "keys.bep"))).toBe(false);
		expect(readdirSync(dir).sort()).toEqual(["config.json"]);
		// The binding receipt pins the generated payment key in the real Vault.
		// The root completes in-process via the returned public binding.
		const io = createEmbeddedVaultIo({ vaultPath });
		try {
			const keys = await io.unlock({
				password: PASSWORD,
				binding: result.vaultBinding,
			});
			expect(keys.payPk?.toPublicKey().toString().toLowerCase()).toBe(
				binding.payment.publicKey.toLowerCase(),
			);
			expect(keys.payPk?.toAddress([0x00])).toBe(result.address);
		} finally {
			io.lock();
		}
		// Public binding only: vaultId/entry IDs/public keys are safe to return.
		expect(result.vaultBinding.vaultId).toBe(binding.vaultId);
		expect(result.vaultBinding.payment.entryId).toBe(binding.payment.entryId);
		expect(result.vaultBinding.payment.publicKey).toBe(
			binding.payment.publicKey,
		);
		const serialized = JSON.stringify(result);
		expect(serialized).toContain("vaultId");
		expect(serialized).toContain("entryId");
		expect(serialized).toContain("publicKey");
		// No secrets, credentials, or paths ever leave the trusted result.
		expect(Object.keys(result.vaultBinding).sort()).toEqual(
			Object.keys(binding).sort(),
		);
		expect(serialized).not.toContain(PASSWORD);
		expect(serialized).not.toContain(vaultPath);
		expect(serialized.toLowerCase()).not.toContain("xprv");
		expect(serialized.toLowerCase()).not.toContain("wif");
		expect(serialized).not.toContain("mnemonic");
		expect(
			readdirSync(accountsDir).some((entry) => entry.includes("first-run")),
		).toBe(false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("fresh create with explicit test chain derives a testnet address", async () => {
	const root = tempRoot("bsv-first-run-test-");
	try {
		const vaultPath = join(root, "vault.bep");
		const accountsDir = join(root, "accounts");
		const backend = createEmbeddedFirstRunBackend({
			vaultPath,
			accountsDirectory: accountsDir,
			chain: "test",
		});
		const result = await backend.create({
			accountName: "bob",
			password: PASSWORD,
			passwordConfirmation: PASSWORD,
			confirmation: "CREATE_NEW_CONFIRMED",
		});
		expect(
			result.address.startsWith("m") || result.address.startsWith("n"),
		).toBe(true);
		const config = readAccount("bob", accountsDir);
		expect(config?.chain).toBe("test");
		expect(config?.address).toBe(result.address);
		const binding = config?.vaultBinding;
		if (!binding) throw new Error("Expected persisted vault binding");
		expect(embeddedVaultBindingSchema.parse(binding)).toEqual(binding);
		expect(embeddedVaultBindingSchema.parse(result.vaultBinding)).toEqual(
			result.vaultBinding,
		);
		expect(result.vaultBinding).toEqual(binding);
		const io = createEmbeddedVaultIo({ vaultPath });
		try {
			const keys = await io.unlock({
				password: PASSWORD,
				binding: result.vaultBinding,
			});
			expect(keys.payPk?.toAddress([0x6f])).toBe(result.address);
		} finally {
			io.lock();
		}
		const serialized = JSON.stringify(result);
		expect(serialized).not.toContain(PASSWORD);
		expect(serialized).not.toContain(vaultPath);
		expect(serialized.toLowerCase()).not.toContain("xprv");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("wrong confirmation, mismatched confirmation, and short password leave no artifacts", async () => {
	const root = tempRoot("bsv-first-run-invalid-");
	try {
		const vaultPath = join(root, "vault.bep");
		const accountsDir = join(root, "accounts");
		const backend = createEmbeddedFirstRunBackend({
			vaultPath,
			accountsDirectory: accountsDir,
		});
		const wrong = await expectRejectCode(
			backend.create({
				accountName: "alice",
				password: PASSWORD,
				passwordConfirmation: PASSWORD,
				confirmation: "WRONG" as unknown as "CREATE_NEW_CONFIRMED",
			}),
			"EMBEDDED_FIRST_RUN_CONFIRMATION_REQUIRED",
		);
		expect(wrong.message).not.toContain(PASSWORD);
		const mismatched = await expectRejectCode(
			backend.create({
				accountName: "alice",
				password: PASSWORD,
				passwordConfirmation: OTHER_PASSWORD,
				confirmation: "CREATE_NEW_CONFIRMED",
			}),
			"EMBEDDED_FIRST_RUN_FAILED",
		);
		expect(mismatched.message).not.toContain(PASSWORD);
		expect(mismatched.message).not.toContain(OTHER_PASSWORD);
		const short = await expectRejectCode(
			backend.create({
				accountName: "alice",
				password: "short",
				passwordConfirmation: "short",
				confirmation: "CREATE_NEW_CONFIRMED",
			}),
			"EMBEDDED_FIRST_RUN_FAILED",
		);
		expect(short.message).not.toContain("short");
		const invalidName = await expectRejectCode(
			backend.create({
				accountName: "Alice",
				password: PASSWORD,
				passwordConfirmation: PASSWORD,
				confirmation: "CREATE_NEW_CONFIRMED",
			}),
			"EMBEDDED_FIRST_RUN_FAILED",
		);
		expect(invalidName.message).not.toContain("Alice");
		expect(existsSync(vaultPath)).toBe(false);
		expect(existsSync(accountsDir)).toBe(false);
		try {
			createEmbeddedFirstRunBackend({
				vaultPath: "relative/vault.bep",
				accountsDirectory: accountsDir,
			});
			throw new Error("Expected factory to reject a relative vault path");
		} catch (error) {
			expect((error as { code?: string }).code).toBe(
				"EMBEDDED_FIRST_RUN_FAILED",
			);
			expect((error as Error).message).not.toContain("relative/vault.bep");
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("existing account directory, config, keys, or db refuses before vault creation", async () => {
	const root = tempRoot("bsv-first-run-exists-");
	try {
		const vaultPath = join(root, "vault.bep");
		const accountsDir = join(root, "accounts");
		writeAccount(
			"alice",
			{
				chain: "main",
				storageIdentityKey: "pre-existing-key",
				address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
				depositPrefix: "mcp",
			},
			accountsDir,
		);
		const dir = accountDir("alice", accountsDir);
		writeFileSync(join(dir, "keys.bep"), "dummy-key-bytes");
		writeFileSync(join(dir, "wallet.db"), "dummy-db-bytes");
		const configBefore = readFileSync(join(dir, "config.json"));
		const keysBefore = readFileSync(join(dir, "keys.bep"));
		const dbBefore = readFileSync(join(dir, "wallet.db"));
		mkdirSync(join(accountsDir, "empty"), { recursive: true });
		const backend = createEmbeddedFirstRunBackend({
			vaultPath,
			accountsDirectory: accountsDir,
		});
		await expectRejectCode(
			backend.create({
				accountName: "alice",
				password: PASSWORD,
				passwordConfirmation: PASSWORD,
				confirmation: "CREATE_NEW_CONFIRMED",
			}),
			"EMBEDDED_FIRST_RUN_ACCOUNT_EXISTS",
		);
		await expectRejectCode(
			backend.create({
				accountName: "empty",
				password: PASSWORD,
				passwordConfirmation: PASSWORD,
				confirmation: "CREATE_NEW_CONFIRMED",
			}),
			"EMBEDDED_FIRST_RUN_ACCOUNT_EXISTS",
		);
		expect(existsSync(vaultPath)).toBe(false);
		expect(readFileSync(join(dir, "config.json")).equals(configBefore)).toBe(
			true,
		);
		expect(readFileSync(join(dir, "keys.bep")).equals(keysBefore)).toBe(true);
		expect(readFileSync(join(dir, "wallet.db")).equals(dbBefore)).toBe(true);
		expect(readAccount("alice", accountsDir)?.address).toBe(
			"1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
		);
		expect(
			readdirSync(accountsDir).some((entry) => entry.includes("first-run")),
		).toBe(false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("existing vault appends a new payment and preserves prior entries", async () => {
	const root = tempRoot("bsv-first-run-vault-exists-");
	try {
		const vaultPath = join(root, "vault.bep");
		const accountsDir = join(root, "accounts");
		const password = PASSWORD;
		const seeder = createEmbeddedVaultIo({ vaultPath });
		let original: Awaited<ReturnType<typeof seeder.create>>;
		try {
			original = await seeder.create({
				password,
				passwordConfirmation: password,
				label: "seed payment",
			});
		} finally {
			seeder.lock();
		}
		const real = await import("@opl.dev/vault");
		const beforeHandle = await real.openVault(
			vaultPath,
			new real.PassphraseProvider(password),
		);
		const beforeEntries = structuredClone(beforeHandle.toDocument().entries);
		beforeHandle.lock();
		const backend = createEmbeddedFirstRunBackend({
			vaultPath,
			accountsDirectory: accountsDir,
		});
		const result = await backend.create({
			accountName: "bob",
			password,
			passwordConfirmation: password,
			confirmation: "CREATE_NEW_CONFIRMED",
		});
		expect(result.accountName).toBe("bob");
		expect(result.address.startsWith("1")).toBe(true);
		expect(result.vaultBinding.vaultId).toBe(original.vaultId);
		expect(result.vaultBinding.payment.entryId).not.toBe(
			original.payment.entryId,
		);
		expect(readAccount("bob", accountsDir)?.vaultBinding).toEqual(
			result.vaultBinding,
		);
		const afterHandle = await real.openVault(
			vaultPath,
			new real.PassphraseProvider(password),
		);
		const afterEntries = afterHandle.toDocument().entries;
		afterHandle.lock();
		expect(afterEntries.length).toBe(beforeEntries.length + 1);
		for (const entry of beforeEntries)
			expect(
				afterEntries.find((candidate) => candidate.id === entry.id),
			).toEqual(entry);
		const verifier = createEmbeddedVaultIo({ vaultPath });
		try {
			const priorKeys = await verifier.unlock({
				password,
				binding: original,
			});
			expect(priorKeys.payPk?.toPublicKey().toString()).toBe(
				original.payment.publicKey,
			);
			const newKeys = await verifier.unlock({
				password,
				binding: result.vaultBinding,
			});
			expect(newKeys.payPk?.toAddress([0x00])).toBe(result.address);
		} finally {
			verifier.lock();
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("existing vault wrong password preserves the vault and creates no account", async () => {
	const root = tempRoot("bsv-first-run-vault-wrong-password-");
	try {
		const vaultPath = join(root, "vault.bep");
		const accountsDir = join(root, "accounts");
		const seeder = createEmbeddedVaultIo({ vaultPath });
		let original: Awaited<ReturnType<typeof seeder.create>>;
		try {
			original = await seeder.create({
				password: PASSWORD,
				passwordConfirmation: PASSWORD,
				label: "seed payment",
			});
		} finally {
			seeder.lock();
		}
		const vaultBefore = readFileSync(vaultPath);
		const backend = createEmbeddedFirstRunBackend({
			vaultPath,
			accountsDirectory: accountsDir,
		});
		const error = await expectRejectCode(
			backend.create({
				accountName: "bob",
				password: OTHER_PASSWORD,
				passwordConfirmation: OTHER_PASSWORD,
				confirmation: "CREATE_NEW_CONFIRMED",
			}),
			"EMBEDDED_FIRST_RUN_FAILED",
		);
		expect(error.message).not.toContain(OTHER_PASSWORD);
		expect(error.message).not.toContain(vaultPath);
		expect(readFileSync(vaultPath).equals(vaultBefore)).toBe(true);
		expect(existsSync(join(accountsDir, "bob"))).toBe(false);
		expect(
			readdirSync(accountsDir).some((entry) => entry.includes("first-run")),
		).toBe(false);
		const verifier = createEmbeddedVaultIo({ vaultPath });
		try {
			const keys = await verifier.unlock({
				password: PASSWORD,
				binding: original,
			});
			expect(keys.payPk?.toPublicKey().toString()).toBe(
				original.payment.publicKey,
			);
		} finally {
			verifier.lock();
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("account persistence failure after vault creation leaves the vault intact", async () => {
	const root = tempRoot("bsv-first-run-write-fail-");
	try {
		const vaultPath = join(root, "vault.bep");
		const accountsDir = join(root, "accounts");
		const backend = createEmbeddedFirstRunBackend({
			vaultPath,
			accountsDirectory: accountsDir,
			writeAccountImpl: () => {
				throw new Error("simulated persistence outage");
			},
		});
		const error = await expectRejectCode(
			backend.create({
				accountName: "carol",
				password: PASSWORD,
				passwordConfirmation: PASSWORD,
				confirmation: "CREATE_NEW_CONFIRMED",
			}),
			"EMBEDDED_FIRST_RUN_FAILED",
		);
		expect(error.message).not.toContain(PASSWORD);
		expect(error.message).not.toContain(vaultPath);
		expect(error.message).not.toContain("simulated persistence outage");
		expect(error.message.toLowerCase()).not.toContain("wif");
		expect(error.message.toLowerCase()).not.toContain("xprv");
		expect(existsSync(vaultPath)).toBe(true);
		expect(readFileSync(vaultPath).length).toBeGreaterThan(0);
		expect(
			readdirSync(accountsDir).some((entry) => entry.includes("first-run")),
		).toBe(false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("foreign reservation is busy and never deleted; repeat create exists", async () => {
	const root = tempRoot("bsv-first-run-busy-");
	try {
		const vaultPath = join(root, "vault.bep");
		const accountsDir = join(root, "accounts");
		mkdirSync(accountsDir, { recursive: true, mode: 0o700 });
		writeFileSync(join(accountsDir, lockName("carol")), "foreign\n", {
			flag: "wx",
			mode: 0o600,
		});
		const backend = createEmbeddedFirstRunBackend({
			vaultPath,
			accountsDirectory: accountsDir,
		});
		await expectRejectCode(
			backend.create({
				accountName: "carol",
				password: PASSWORD,
				passwordConfirmation: PASSWORD,
				confirmation: "CREATE_NEW_CONFIRMED",
			}),
			"EMBEDDED_FIRST_RUN_BUSY",
		);
		expect(readFileSync(join(accountsDir, lockName("carol")), "utf8")).toBe(
			"foreign\n",
		);
		expect(existsSync(vaultPath)).toBe(false);
		expect(existsSync(join(accountsDir, "carol"))).toBe(false);
		rmSync(join(accountsDir, lockName("carol")), { force: true });
		const first = await backend.create({
			accountName: "dave",
			password: PASSWORD,
			passwordConfirmation: PASSWORD,
			confirmation: "CREATE_NEW_CONFIRMED",
		});
		const vaultAfterFirst = readFileSync(vaultPath);
		expect(first.accountName).toBe("dave");
		await expectRejectCode(
			backend.create({
				accountName: "dave",
				password: PASSWORD,
				passwordConfirmation: PASSWORD,
				confirmation: "CREATE_NEW_CONFIRMED",
			}),
			"EMBEDDED_FIRST_RUN_ACCOUNT_EXISTS",
		);
		expect(readFileSync(vaultPath).equals(vaultAfterFirst)).toBe(true);
		expect(readAccount("dave", accountsDir)?.address).toBe(first.address);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("replaced lock with identical nonce is never deleted", async () => {
	const root = tempRoot("bsv-first-run-replaced-");
	try {
		const vaultPath = join(root, "vault.bep");
		const accountsDir = join(root, "accounts");
		let planted = "";
		const backend = createEmbeddedFirstRunBackend({
			vaultPath,
			accountsDirectory: accountsDir,
			writeAccountImpl: ((name, config, dir, opts) => {
				const accountRoot = dir ?? accountsDir;
				const lockPath = join(accountRoot, lockName(name));
				const raw = readFileSync(lockPath, "utf8");
				// Same nonce content but a new inode: nonce-only cleanup would
				// delete this foreign replacement; identity cleanup must keep it.
				rmSync(lockPath, { force: true });
				writeFileSync(lockPath, raw, { mode: 0o600 });
				planted = readFileSync(lockPath, "utf8");
				return writeAccount(name, config, dir, opts);
			}) as typeof writeAccount,
		});
		const result = await backend.create({
			accountName: "frank",
			password: PASSWORD,
			passwordConfirmation: PASSWORD,
			confirmation: "CREATE_NEW_CONFIRMED",
		});
		expect(result.accountName).toBe("frank");
		expect(embeddedVaultBindingSchema.parse(result.vaultBinding)).toEqual(
			result.vaultBinding,
		);
		// The replaced lock survived release; only the exact held file may go.
		expect(existsSync(join(accountsDir, lockName("frank")))).toBe(true);
		expect(readFileSync(join(accountsDir, lockName("frank")), "utf8")).toBe(
			planted,
		);
		expect(readAccount("frank", accountsDir)?.address).toBe(result.address);
		// The returned public binding still unlocks in-process.
		const io = createEmbeddedVaultIo({ vaultPath });
		try {
			const keys = await io.unlock({
				password: PASSWORD,
				binding: result.vaultBinding,
			});
			expect(keys.payPk?.toAddress([0x00])).toBe(result.address);
		} finally {
			io.lock();
		}
		rmSync(join(accountsDir, lockName("frank")), { force: true });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("concurrent creates for the same account allow exactly one winner", async () => {
	const root = tempRoot("bsv-first-run-race-");
	try {
		const accountsDir = join(root, "accounts");
		const first = createEmbeddedFirstRunBackend({
			vaultPath: join(root, "first.bep"),
			accountsDirectory: accountsDir,
		});
		const second = createEmbeddedFirstRunBackend({
			vaultPath: join(root, "second.bep"),
			accountsDirectory: accountsDir,
		});
		const input = {
			accountName: "erin",
			password: PASSWORD,
			passwordConfirmation: PASSWORD,
			confirmation: "CREATE_NEW_CONFIRMED" as const,
		};
		const [left, right] = await Promise.allSettled([
			first.create(input),
			second.create(input),
		]);
		const fulfilled = [left, right].filter((o) => o.status === "fulfilled");
		const rejected = [left, right].filter((o) => o.status === "rejected");
		expect(fulfilled.length).toBe(1);
		expect(rejected.length).toBe(1);
		const loser = (rejected[0] as PromiseRejectedResult).reason as {
			code?: string;
		};
		expect(loser.code).toBeDefined();
		expect([
			"EMBEDDED_FIRST_RUN_BUSY",
			"EMBEDDED_FIRST_RUN_ACCOUNT_EXISTS",
		]).toContain(loser.code as string);
		expect(readAccount("erin", accountsDir)?.address).toBe(
			(
				fulfilled[0] as PromiseFulfilledResult<{
					address: string;
				}>
			).value.address,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
