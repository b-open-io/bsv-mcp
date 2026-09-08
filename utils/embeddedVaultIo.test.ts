import { afterEach, expect, test } from "bun:test";
import { randomBytes, randomUUID } from "node:crypto";
import {
	chmodSync,
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { HD, PrivateKey } from "@bsv/sdk";
import {
	createEmbeddedVaultIo,
	EmbeddedVaultError,
	type EmbeddedVaultReceipt,
} from "./embeddedVaultIo";

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});

/** Canonical realpath tmp root, avoiding the macOS /tmp alias. */
function fixture(): string {
	const root = mkdtempSync(join(realpathSync(tmpdir()), "embedded-vault-io-"));
	roots.push(root);
	return root;
}

const dest = (root: string): string => join(root, `vault-${randomUUID()}.bep`);

function freshKeys() {
	const pay = PrivateKey.fromRandom();
	const identity = PrivateKey.fromRandom();
	const hd = HD.fromSeed(Array.from(randomBytes(32)));
	return {
		payWif: pay.toWif(),
		payPub: pay.toPublicKey().toString(),
		identityWif: identity.toWif(),
		identityPub: identity.toPublicKey().toString(),
		xprv: hd.toString(),
		expectedXpub: hd.toPublic().toString(),
		hdPub: hd.pubKey.toString(),
	};
}

async function expectCode(
	work: () => Promise<unknown>,
	code: string,
): Promise<EmbeddedVaultError> {
	try {
		await work();
	} catch (error) {
		expect(error).toBeInstanceOf(EmbeddedVaultError);
		expect((error as EmbeddedVaultError).code).toBe(code);
		return error as EmbeddedVaultError;
	}
	throw new Error(`Expected EmbeddedVaultError(${code})`);
}

function siblings(root: string, base: string): string[] {
	return readdirSync(root).filter((name) => name.startsWith(base));
}

test("fresh create and unlock roundtrip pins the generated payment key", async () => {
	const root = fixture();
	const path = dest(root);
	const io = createEmbeddedVaultIo({ vaultPath: path });
	const receipt = await io.create({
		password: "correct-horse-1",
		passwordConfirmation: "correct-horse-1",
		label: "primary",
	});
	expect(Object.keys(receipt).sort()).toEqual(["payment", "vaultId"]);
	expect(receipt.vaultId.length).toBeGreaterThan(0);
	expect(receipt.payment.publicKey).toMatch(/^(02|03)[0-9a-f]{64}$/i);
	const keys = await io.unlock({
		password: "correct-horse-1",
		binding: receipt,
	});
	expect(keys.payPk?.toPublicKey().toString()).toBe(receipt.payment.publicKey);
	expect(keys.identityPk).toBeUndefined();
	expect(keys.xprv).toBeUndefined();
	io.lock();
});

test("create validates password and confirmation before any write", async () => {
	const root = fixture();
	const path = dest(root);
	const io = createEmbeddedVaultIo({ vaultPath: path });
	await expectCode(
		() =>
			io.create({
				password: "short",
				passwordConfirmation: "short",
				label: "x",
			}),
		"INVALID_PASSWORD",
	);
	await expectCode(
		() =>
			io.create({
				password: "long-enough-1",
				passwordConfirmation: "different-2",
				label: "x",
			}),
		"PASSWORD_MISMATCH",
	);
	expect(existsSync(path)).toBe(false);
	expect(siblings(root, basename(path))).toEqual([]);
});

test("existing destination always refuses create without reset", async () => {
	const root = fixture();
	const path = dest(root);
	const io = createEmbeddedVaultIo({ vaultPath: path });
	const receipt = await io.create({
		password: "original-pass-1",
		passwordConfirmation: "original-pass-1",
		label: "primary",
	});
	const before = readFileSync(path);
	await expectCode(
		() =>
			io.create({
				password: "replacement-2",
				passwordConfirmation: "replacement-2",
				label: "primary",
			}),
		"VAULT_EXISTS",
	);
	expect(readFileSync(path).equals(before)).toBe(true);
	const keys = await io.unlock({
		password: "original-pass-1",
		binding: receipt,
	});
	expect(keys.payPk?.toPublicKey().toString()).toBe(receipt.payment.publicKey);
	io.lock();
});

test("wrong password fails closed without secret leakage", async () => {
	const root = fixture();
	const path = dest(root);
	const password = "vault-password-1";
	const io = createEmbeddedVaultIo({ vaultPath: path });
	const receipt = await io.create({
		password,
		passwordConfirmation: password,
		label: "primary",
	});
	const error = await expectCode(
		() => io.unlock({ password: "wrong-password-9", binding: receipt }),
		"UNLOCK_FAILED",
	);
	expect(error.message).not.toContain(password);
	expect(error.message).not.toContain(receipt.payment.publicKey);
});

test("binding mismatches fail closed with fixed codes", async () => {
	const root = fixture();
	const path = dest(root);
	const password = "vault-password-1";
	const io = createEmbeddedVaultIo({ vaultPath: path });
	const receipt = await io.create({
		password,
		passwordConfirmation: password,
		label: "primary",
	});
	const other = PrivateKey.fromRandom().toPublicKey().toString();
	await expectCode(
		() =>
			io.unlock({
				password,
				binding: {
					...receipt,
					payment: { ...receipt.payment, publicKey: other },
				},
			}),
		"BINDING_MISMATCH",
	);
	await expectCode(
		() => io.unlock({ password, binding: { ...receipt, vaultId: "nope" } }),
		"BINDING_MISMATCH",
	);
	await expectCode(
		() =>
			io.unlock({
				password,
				binding: {
					...receipt,
					payment: { ...receipt.payment, entryId: "missing-entry" },
				},
			}),
		"BINDING_MISMATCH",
	);
	// No alternate-entry fallback: the payment entry is not an hd entry.
	await expectCode(
		() =>
			io.unlock({
				password,
				binding: {
					...receipt,
					hd: { entryId: receipt.payment.entryId, expectedXpub: other },
				},
			}),
		"BINDING_MISMATCH",
	);
	// The vault still unlocks with the exact binding afterwards.
	const keys = await io.unlock({ password, binding: receipt });
	expect(keys.payPk?.toPublicKey().toString()).toBe(receipt.payment.publicKey);
	io.lock();
});

test("import appends pay/identity/xprv and preserves existing entries", async () => {
	const root = fixture();
	const path = dest(root);
	const password = "vault-password-1";
	const io = createEmbeddedVaultIo({ vaultPath: path });
	const original = await io.create({
		password,
		passwordConfirmation: password,
		label: "primary",
	});
	const real = await import("@opl.dev/vault");
	const beforeHandle = await real.openVault(
		path,
		new real.PassphraseProvider(password),
	);
	const beforeEntries = structuredClone(beforeHandle.toDocument().entries);
	beforeHandle.lock();
	const keys = freshKeys();
	const receipt = await io.importKeys({
		password,
		label: "imported",
		keys: {
			payPk: keys.payWif,
			identityPk: keys.identityWif,
			xprv: keys.xprv,
		},
	});
	expect(receipt.vaultId).toBe(original.vaultId);
	expect(receipt.payment.publicKey).toBe(keys.payPub);
	expect(receipt.identity?.publicKey).toBe(keys.identityPub);
	expect(receipt.hd?.expectedXpub).toBe(keys.expectedXpub);
	expect(receipt.hd?.expectedXpub.startsWith("xpub")).toBe(true);
	expect(receipt.hd?.expectedXpub).toBe(
		HD.fromString(keys.xprv).toPublic().toString(),
	);
	// The hd-private entry metadata pins the compressed pubkey, while the
	// receipt pins the extended public key exactly (case-sensitive).
	const stagedCheck = await real.openVault(
		path,
		new real.PassphraseProvider(password),
	);
	const hdEntry = stagedCheck
		.toDocument()
		.entries.find((entry) => entry.id === receipt.hd?.entryId);
	expect(hdEntry?.kind).toBe("hd-private");
	expect(hdEntry?.publicKey).toBe(keys.hdPub);
	stagedCheck.lock();
	expect(Object.keys(receipt).sort()).toEqual([
		"hd",
		"identity",
		"payment",
		"vaultId",
	]);
	const unlocked = await io.unlock({ password, binding: receipt });
	expect(unlocked.payPk?.toWif()).toBe(keys.payWif);
	expect(unlocked.identityPk?.toWif()).toBe(keys.identityWif);
	expect(unlocked.xprv).toBe(keys.xprv);
	io.lock();
	// Existing entries are retained exactly and the password is unchanged.
	const stillThere = await io.unlock({ password, binding: original });
	expect(stillThere.payPk?.toPublicKey().toString()).toBe(
		original.payment.publicKey,
	);
	io.lock();
	const afterHandle = await real.openVault(
		path,
		new real.PassphraseProvider(password),
	);
	const afterEntries = afterHandle.toDocument().entries;
	afterHandle.lock();
	expect(afterEntries.length).toBe(beforeEntries.length + 3);
	for (const entry of beforeEntries)
		expect(afterEntries.find((candidate) => candidate.id === entry.id)).toEqual(
			entry,
		);
});

test("fresh import requires matching min-8 confirmation", async () => {
	const root = fixture();
	const path = dest(root);
	const io = createEmbeddedVaultIo({ vaultPath: path });
	const keys = freshKeys();
	const valid = {
		payPk: keys.payWif,
		identityPk: keys.identityWif,
		xprv: keys.xprv,
	};
	await expectCode(
		() => io.importKeys({ password: "long-enough-1", label: "x", keys: valid }),
		"PASSWORD_MISMATCH",
	);
	await expectCode(
		() =>
			io.importKeys({
				password: "long-enough-1",
				passwordConfirmation: "other-2",
				label: "x",
				keys: valid,
			}),
		"PASSWORD_MISMATCH",
	);
	await expectCode(
		() =>
			io.importKeys({
				password: "short",
				passwordConfirmation: "short",
				label: "x",
				keys: valid,
			}),
		"INVALID_PASSWORD",
	);
	await expectCode(
		() =>
			io.importKeys({
				password: "long-enough-1",
				passwordConfirmation: "long-enough-1",
				label: "x",
				keys: { payPk: "not-a-wif" },
			}),
		"INVALID_KEY",
	);
	await expectCode(
		() =>
			io.importKeys({
				password: "long-enough-1",
				passwordConfirmation: "long-enough-1",
				label: "x",
				keys: { payPk: keys.payWif, xprv: "not-an-xprv" },
			}),
		"INVALID_KEY",
	);
	expect(existsSync(path)).toBe(false);
	expect(siblings(root, basename(path))).toEqual([]);
});

test("existing import needs no confirmation and keeps the password", async () => {
	const root = fixture();
	const path = dest(root);
	const password = "vault-password-1";
	const io = createEmbeddedVaultIo({ vaultPath: path });
	await io.create({
		password,
		passwordConfirmation: password,
		label: "primary",
	});
	const keys = freshKeys();
	const receipt = await io.importKeys({
		password,
		label: "added",
		keys: { payPk: keys.payWif },
	});
	expect(receipt.identity).toBeUndefined();
	expect(receipt.hd).toBeUndefined();
	const unlocked = await io.unlock({ password, binding: receipt });
	expect(unlocked.payPk?.toWif()).toBe(keys.payWif);
	io.lock();
});

test("preexisting lock is busy and never stolen", async () => {
	const root = fixture();
	const path = dest(root);
	const sentinel = JSON.stringify({ owner: "someone-else" });
	writeFileSync(`${path}.lock`, sentinel);
	const io = createEmbeddedVaultIo({ vaultPath: path });
	await expectCode(
		() =>
			io.create({
				password: "long-enough-1",
				passwordConfirmation: "long-enough-1",
				label: "x",
			}),
		"VAULT_BUSY",
	);
	expect(readFileSync(`${path}.lock`, "utf8")).toBe(sentinel);
	expect(existsSync(path)).toBe(false);
});

test("concurrent creates serialize on the exclusive lock", async () => {
	const root = fixture();
	const path = dest(root);
	const first = createEmbeddedVaultIo({ vaultPath: path });
	const second = createEmbeddedVaultIo({ vaultPath: path });
	const input = {
		password: "long-enough-1",
		passwordConfirmation: "long-enough-1",
		label: "race",
	};
	const outcomes = await Promise.allSettled([
		first.create(input),
		second.create(input),
	]);
	const fulfilled = outcomes.filter(
		(outcome): outcome is PromiseFulfilledResult<EmbeddedVaultReceipt> =>
			outcome.status === "fulfilled",
	);
	const rejected = outcomes.filter(
		(outcome): outcome is PromiseRejectedResult =>
			outcome.status === "rejected",
	);
	expect(fulfilled.length).toBe(1);
	expect(rejected.length).toBe(1);
	expect(["VAULT_BUSY", "VAULT_EXISTS"]).toContain(
		(rejected[0] as PromiseRejectedResult).reason?.code,
	);
	const winner = fulfilled[0] as PromiseFulfilledResult<EmbeddedVaultReceipt>;
	const keys = await first.unlock({
		password: "long-enough-1",
		binding: winner.value,
	});
	expect(keys.payPk?.toPublicKey().toString()).toBe(
		winner.value.payment.publicKey,
	);
	first.lock();
	second.lock();
});

test("mid-commit destination change fails the revision check", async () => {
	const root = fixture();
	const path = dest(root);
	const password = "vault-password-1";
	const setup = createEmbeddedVaultIo({ vaultPath: path });
	await setup.create({
		password,
		passwordConfirmation: password,
		label: "primary",
	});
	const real = await import("@opl.dev/vault");
	const tamperingLoadModule = async (): Promise<unknown> => ({
		PassphraseProvider: real.PassphraseProvider,
		createVault: (
			...args: Parameters<typeof real.createVault>
		): ReturnType<typeof real.createVault> => real.createVault(...args),
		openVault: (
			...args: Parameters<typeof real.openVault>
		): ReturnType<typeof real.openVault> => real.openVault(...args),
		saveVault: async (
			...args: Parameters<typeof real.saveVault>
		): Promise<void> => {
			const raw = readFileSync(path);
			const tampered = Buffer.from(raw);
			tampered[0] ^= 1;
			writeFileSync(path, tampered);
			await real.saveVault(...args);
		},
	});
	const io = createEmbeddedVaultIo({
		vaultPath: path,
		loadModule: tamperingLoadModule,
	});
	const keys = freshKeys();
	const valid = {
		payPk: keys.payWif,
		identityPk: keys.identityWif,
		xprv: keys.xprv,
	};
	await expectCode(
		() => io.importKeys({ password, label: "added", keys: valid }),
		"VAULT_CHANGED",
	);
	// The owned lock is released, but encrypted recovery artifacts are kept.
	expect(existsSync(`${path}.lock`)).toBe(false);
	expect(siblings(root, `${basename(path)}.stage-`).length).toBeGreaterThan(0);
});

test("disk contents never carry plaintext secrets", async () => {
	const root = fixture();
	const path = dest(root);
	const password = "disk-secrecy-99";
	const io = createEmbeddedVaultIo({ vaultPath: path });
	await io.create({
		password,
		passwordConfirmation: password,
		label: "primary",
	});
	const keys = freshKeys();
	const receipt = await io.importKeys({
		password,
		label: "added",
		keys: {
			payPk: keys.payWif,
			identityPk: keys.identityWif,
			xprv: keys.xprv,
		},
	});
	const unlocked = await io.unlock({ password, binding: receipt });
	expect(unlocked.xprv).toBe(keys.xprv);
	io.lock();
	const names = readdirSync(root);
	expect(names.some((name) => name.includes(".stage-"))).toBe(false);
	expect(names.some((name) => name.endsWith(".lock"))).toBe(false);
	for (const name of names) {
		const raw = readFileSync(join(root, name), "utf8");
		for (const secret of [keys.payWif, keys.identityWif, keys.xprv, password])
			expect(raw.includes(secret)).toBe(false);
	}
});

test("session lock replaces sessions and stays usable", async () => {
	const root = fixture();
	const path = dest(root);
	const password = "vault-password-1";
	const io = createEmbeddedVaultIo({ vaultPath: path });
	const receipt = await io.create({
		password,
		passwordConfirmation: password,
		label: "primary",
	});
	const first = await io.unlock({ password, binding: receipt });
	const second = await io.unlock({ password, binding: receipt });
	expect(second.payPk?.toWif()).toBe(first.payPk?.toWif());
	io.lock();
	io.lock();
	const third = await io.unlock({ password, binding: receipt });
	expect(third.payPk?.toPublicKey().toString()).toBe(receipt.payment.publicKey);
	io.lock();
});

test("reveal-disabled vaults fail closed without mutation", async () => {
	const root = fixture();
	const path = dest(root);
	const password = "vault-password-1";
	const real = await import("@opl.dev/vault");
	const seed = await real.createVault(
		path,
		[new real.PassphraseProvider(password)],
		{ revealEnabled: false },
	);
	seed.lock();
	const io = createEmbeddedVaultIo({ vaultPath: path });
	const keys = freshKeys();
	await expectCode(
		() =>
			io.importKeys({
				password,
				label: "added",
				keys: { payPk: keys.payWif, xprv: keys.xprv },
			}),
		"REVEAL_DISABLED",
	);
	const check = await real.openVault(
		path,
		new real.PassphraseProvider(password),
	);
	expect(check.toDocument().entries.length).toBe(0);
	expect(check.toDocument().settings.revealEnabled).toBe(false);
	check.lock();
});

test("symlink destinations and ancestors are rejected", async () => {
	const root = fixture();
	const target = join(root, "target.bep");
	writeFileSync(target, "sentinel");
	const linked = join(root, "linked.bep");
	symlinkSync(target, linked);
	const io = createEmbeddedVaultIo({ vaultPath: linked });
	await expectCode(
		() =>
			io.create({
				password: "long-enough-1",
				passwordConfirmation: "long-enough-1",
				label: "x",
			}),
		"INVALID_PATH",
	);
	expect(readFileSync(target, "utf8")).toBe("sentinel");
	const realDir = join(root, "realdir");
	rmSync(realDir, { recursive: true, force: true });
	const { mkdirSync } = await import("node:fs");
	mkdirSync(realDir, { recursive: true });
	const linkDir = join(root, "linkdir");
	symlinkSync(realDir, linkDir);
	const nested = createEmbeddedVaultIo({
		vaultPath: join(linkDir, "vault.bep"),
	});
	await expectCode(
		() =>
			nested.create({
				password: "long-enough-1",
				passwordConfirmation: "long-enough-1",
				label: "x",
			}),
		"INVALID_PATH",
	);
});

test("relative destinations are rejected", async () => {
	const io = createEmbeddedVaultIo({ vaultPath: "relative/vault.bep" });
	await expectCode(
		() =>
			io.create({
				password: "long-enough-1",
				passwordConfirmation: "long-enough-1",
				label: "x",
			}),
		"INVALID_PATH",
	);
});

test("public HD input is rejected and mismatched xpub pins fail closed", async () => {
	const root = fixture();
	const path = dest(root);
	const password = "vault-password-1";
	const io = createEmbeddedVaultIo({ vaultPath: path });
	await io.create({
		password,
		passwordConfirmation: password,
		label: "primary",
	});
	const keys = freshKeys();
	// An extended public key is not a private HD key and must be rejected.
	await expectCode(
		() =>
			io.importKeys({
				password,
				label: "bad-hd",
				keys: { payPk: keys.payWif, xprv: keys.expectedXpub },
			}),
		"INVALID_KEY",
	);
	const receipt = await io.importKeys({
		password,
		label: "added",
		keys: { payPk: keys.payWif, xprv: keys.xprv },
	});
	expect(receipt.hd?.expectedXpub.startsWith("xpub")).toBe(true);
	// A mismatched extended pin (different chaincode) must not unlock.
	const otherXpub = HD.fromSeed(Array.from(randomBytes(32)))
		.toPublic()
		.toString();
	expect(otherXpub).not.toBe(receipt.hd?.expectedXpub);
	const hdEntryId = receipt.hd?.entryId ?? "";
	const hdXpub = receipt.hd?.expectedXpub ?? "";
	expect(hdEntryId.length).toBeGreaterThan(0);
	expect(hdXpub.startsWith("xpub")).toBe(true);
	await expectCode(
		() =>
			io.unlock({
				password,
				binding: {
					...receipt,
					hd: { entryId: hdEntryId, expectedXpub: otherXpub },
				},
			}),
		"BINDING_MISMATCH",
	);
	// Lowercasing the extended pin must not match (exact comparison).
	await expectCode(
		() =>
			io.unlock({
				password,
				binding: {
					...receipt,
					hd: {
						entryId: hdEntryId,
						expectedXpub: hdXpub.toLowerCase(),
					},
				},
			}),
		"BINDING_MISMATCH",
	);
	const unlocked = await io.unlock({ password, binding: receipt });
	expect(unlocked.xprv).toBe(keys.xprv);
	io.lock();
});

test("parent directory fsync failure reports uncertain write without success", async () => {
	const root = fixture();
	const path = dest(root);
	const password = "vault-password-1";
	const real = await import("@opl.dev/vault");
	let parentDir = root;
	const failingLoadModule = async (): Promise<unknown> => ({
		PassphraseProvider: real.PassphraseProvider,
		createVault: (
			...args: Parameters<typeof real.createVault>
		): ReturnType<typeof real.createVault> => real.createVault(...args),
		openVault: (
			...args: Parameters<typeof real.openVault>
		): ReturnType<typeof real.openVault> => real.openVault(...args),
		saveVault: async (
			...args: Parameters<typeof real.saveVault>
		): Promise<void> => {
			await real.saveVault(...args);
			// Leave rename permitted (write+execute) but make opening the
			// parent for fsync fail; the real encrypted SDK is still used.
			parentDir = root;
			chmodSync(root, 0o300);
		},
	});
	const io = createEmbeddedVaultIo({
		vaultPath: path,
		loadModule: failingLoadModule,
	});
	const error = await expectCode(
		() =>
			io.create({
				password,
				passwordConfirmation: password,
				label: "primary",
			}),
		"WRITE_FAILED",
	);
	expect(error.message).not.toContain(password);
	try {
		chmodSync(parentDir, 0o700);
		// The owned lock is released, but the uncertain stage is preserved.
		// The activated destination is left in place (no blind rollback),
		// yet the caller receives failure, never false success.
		expect(existsSync(`${path}.lock`)).toBe(false);
		expect(siblings(root, `${basename(path)}.stage-`).length).toBeGreaterThan(
			0,
		);
		expect(existsSync(path)).toBe(true);
	} finally {
		try {
			chmodSync(root, 0o700);
		} catch {
			// Cleanup best-effort; afterEach removes the fixture root.
		}
	}
});

test("replaced exclusive lock aborts the commit without overwriting", async () => {
	const root = fixture();
	const path = dest(root);
	const password = "vault-password-1";
	const setup = createEmbeddedVaultIo({ vaultPath: path });
	const original = await setup.create({
		password,
		passwordConfirmation: password,
		label: "primary",
	});
	const before = readFileSync(path);
	const real = await import("@opl.dev/vault");
	const intruder = JSON.stringify({
		pid: 424242,
		nonce: "intruder-lock",
		at: Date.now(),
	});
	const stealingLoadModule = async (): Promise<unknown> => ({
		PassphraseProvider: real.PassphraseProvider,
		createVault: (
			...args: Parameters<typeof real.createVault>
		): ReturnType<typeof real.createVault> => real.createVault(...args),
		openVault: (
			...args: Parameters<typeof real.openVault>
		): ReturnType<typeof real.openVault> => real.openVault(...args),
		saveVault: async (
			...args: Parameters<typeof real.saveVault>
		): Promise<void> => {
			await real.saveVault(...args);
			// Simulate lock removal/replacement while staged crypto awaited,
			// using the real encrypted SDK for staging. The pre-rename
			// ownership check must abort instead of committing.
			rmSync(`${path}.lock`, { force: true });
			writeFileSync(`${path}.lock`, intruder);
		},
	});
	const io = createEmbeddedVaultIo({
		vaultPath: path,
		loadModule: stealingLoadModule,
	});
	const keys = freshKeys();
	await expectCode(
		() =>
			io.importKeys({ password, label: "added", keys: { payPk: keys.payWif } }),
		"VAULT_CHANGED",
	);
	// Destination unchanged, replaced lock preserved, uncertain stage kept.
	expect(readFileSync(path).equals(before)).toBe(true);
	expect(readFileSync(`${path}.lock`, "utf8")).toBe(intruder);
	expect(siblings(root, `${basename(path)}.stage-`).length).toBeGreaterThan(0);
	const still = await setup.unlock({ password, binding: original });
	expect(still.payPk?.toPublicKey().toString()).toBe(
		original.payment.publicKey,
	);
	setup.lock();
	rmSync(`${path}.lock`, { force: true });
});

test("unlock pins the caller binding across the loader await", async () => {
	const root = fixture();
	const path = dest(root);
	const password = "vault-password-1";
	const setup = createEmbeddedVaultIo({ vaultPath: path });
	const original = await setup.create({
		password,
		passwordConfirmation: password,
		label: "primary",
	});
	const keys = freshKeys();
	const imported = await setup.importKeys({
		password,
		label: "added",
		keys: { payPk: keys.payWif },
	});
	expect(imported.payment.entryId).not.toBe(original.payment.entryId);
	const real = await import("@opl.dev/vault");
	let releaseGate!: () => void;
	let enteredResolve!: () => void;
	const entered = new Promise<void>((resolve) => {
		enteredResolve = resolve;
	});
	const gate = new Promise<void>((resolve) => {
		releaseGate = resolve;
	});
	const holdingLoadModule = async (): Promise<unknown> => {
		enteredResolve();
		await gate;
		return real;
	};
	const io = createEmbeddedVaultIo({
		vaultPath: path,
		loadModule: holdingLoadModule,
	});
	const callerInput = {
		password,
		binding: {
			vaultId: original.vaultId,
			payment: {
				entryId: original.payment.entryId,
				publicKey: original.payment.publicKey,
			},
		},
	};
	const pending = io.unlock(callerInput);
	await entered;
	// Mutate the caller binding while the loader is held; the pinned
	// snapshot must still select the original entry.
	callerInput.binding.payment.entryId = imported.payment.entryId;
	callerInput.binding.payment.publicKey = imported.payment.publicKey;
	releaseGate();
	const result = await pending;
	expect(result.payPk?.toPublicKey().toString()).toBe(
		original.payment.publicKey,
	);
	expect(result.payPk?.toPublicKey().toString()).not.toBe(
		imported.payment.publicKey,
	);
	io.lock();
});
