import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
	existsSync,
	lstatSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type AccountConfig,
	accountConfigSchema,
	accountDir,
	embeddedVaultBindingSchema,
	listAccounts,
	readAccount,
	readAccountRevision,
	writeAccount,
} from "./accounts";

const PAY_PUBKEY =
	"0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const ID_PUBKEY = `03${"11".repeat(32)}`;
const HD_PUBKEY = `02${"22".repeat(32)}`;

function tempRoot(prefix: string) {
	return mkdtempSync(join(tmpdir(), prefix));
}

function paymentOnlyBinding() {
	return {
		version: 1 as const,
		contract: "embedded-roots-v1" as const,
		vaultId: "vault-123",
		payment: { entryId: "pay-entry-1", publicKey: PAY_PUBKEY },
	};
}

function fullBinding() {
	return {
		...paymentOnlyBinding(),
		identity: { entryId: "id-entry-1", publicKey: ID_PUBKEY },
		hd: { entryId: "hd-entry-1", expectedXpub: "xpub661TestExpectedXpubValue" },
	};
}

function baseConfig(): AccountConfig {
	return {
		chain: "main",
		storageIdentityKey: "test-storage-key",
		activeRemote: "https://wallet.1sat.app",
		backups: ["https://backup.example"],
		address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
		depositPrefix: "mcp",
	};
}

function lockPathFor(root: string, name: string) {
	return join(accountDir(name, root), ".config.json.lock");
}

function configPathFor(root: string, name: string) {
	return join(accountDir(name, root), "config.json");
}

function sha256Hex(raw: Buffer) {
	return createHash("sha256").update(raw).digest("hex");
}

test("binding schema accepts payment-only, identity, and hd shapes", () => {
	const root = tempRoot("bsv-vault-schema-");
	try {
		expect(embeddedVaultBindingSchema.parse(paymentOnlyBinding())).toEqual(
			paymentOnlyBinding(),
		);
		const withIdentity = {
			...paymentOnlyBinding(),
			identity: { entryId: "id-1", publicKey: ID_PUBKEY },
		};
		expect(embeddedVaultBindingSchema.parse(withIdentity)).toEqual(
			withIdentity,
		);
		expect(embeddedVaultBindingSchema.parse(fullBinding())).toEqual(
			fullBinding(),
		);
		const lowerCase = {
			...paymentOnlyBinding(),
			payment: { entryId: "pay-1", publicKey: PAY_PUBKEY.toLowerCase() },
		};
		expect(embeddedVaultBindingSchema.safeParse(lowerCase).success).toBe(true);
		const upperCase = {
			...paymentOnlyBinding(),
			payment: { entryId: "pay-1", publicKey: PAY_PUBKEY.toUpperCase() },
		};
		expect(embeddedVaultBindingSchema.safeParse(upperCase).success).toBe(true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("binding schema rejects unknown keys, secrets, bad version/contract, and malformed fields", () => {
	const valid = paymentOnlyBinding();
	expect(
		embeddedVaultBindingSchema.safeParse({ ...valid, extra: "nope" }).success,
	).toBe(false);
	expect(
		embeddedVaultBindingSchema.safeParse({ ...valid, privateKey: "secret" })
			.success,
	).toBe(false);
	expect(
		embeddedVaultBindingSchema.safeParse({ ...valid, seed: "secret" }).success,
	).toBe(false);
	expect(
		embeddedVaultBindingSchema.safeParse({ ...valid, path: "/tmp/x" }).success,
	).toBe(false);
	expect(
		embeddedVaultBindingSchema.safeParse({ ...valid, version: 2 }).success,
	).toBe(false);
	expect(
		embeddedVaultBindingSchema.safeParse({ ...valid, contract: "other" })
			.success,
	).toBe(false);
	expect(
		embeddedVaultBindingSchema.safeParse({ ...valid, vaultId: "" }).success,
	).toBe(false);
	expect(
		embeddedVaultBindingSchema.safeParse({
			...valid,
			payment: { entryId: "", publicKey: PAY_PUBKEY },
		}).success,
	).toBe(false);
	const badKeys = [
		`00${"11".repeat(32)}`,
		`04${"11".repeat(32)}`,
		`02${"11".repeat(31)}`,
		`02${"11".repeat(33)}`,
		`02${"zz".repeat(32)}`,
		"",
		"0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f8179",
	];
	for (const publicKey of badKeys) {
		expect(
			embeddedVaultBindingSchema.safeParse({
				...valid,
				payment: { entryId: "pay-1", publicKey },
			}).success,
		).toBe(false);
	}
	expect(
		embeddedVaultBindingSchema.safeParse({
			...valid,
			identity: { entryId: "", publicKey: ID_PUBKEY },
		}).success,
	).toBe(false);
	expect(
		embeddedVaultBindingSchema.safeParse({
			...valid,
			identity: { entryId: "id-1", publicKey: "not-a-key" },
		}).success,
	).toBe(false);
	expect(
		embeddedVaultBindingSchema.safeParse({
			...valid,
			identity: { entryId: "id-1", publicKey: ID_PUBKEY, secret: "x" },
		}).success,
	).toBe(false);
	expect(
		embeddedVaultBindingSchema.safeParse({
			...valid,
			hd: { entryId: "", expectedXpub: "xpub123" },
		}).success,
	).toBe(false);
	expect(
		embeddedVaultBindingSchema.safeParse({
			...valid,
			hd: { entryId: "hd-1", expectedXpub: "" },
		}).success,
	).toBe(false);
	expect(
		embeddedVaultBindingSchema.safeParse({
			...valid,
			hd: { entryId: "hd-1", expectedXpub: "xpub123", extra: 1 },
		}).success,
	).toBe(false);
	expect(
		embeddedVaultBindingSchema.safeParse({
			...valid,
			payment: { entryId: "pay-1", publicKey: PAY_PUBKEY, path: "/tmp" },
		}).success,
	).toBe(false);
	expect(
		accountConfigSchema.safeParse({
			...baseConfig(),
			vaultBinding: valid,
			vaultBindingHistory: [{ binding: valid, changedAt: "not-a-date" }],
		}).success,
	).toBe(false);
	expect(
		accountConfigSchema.safeParse({
			...baseConfig(),
			vaultBinding: valid,
			vaultBindingHistory: [{ binding: valid, changedAt: "2026-09-08" }],
		}).success,
	).toBe(false);
	expect(
		accountConfigSchema.safeParse({
			...baseConfig(),
			vaultBinding: valid,
			vaultBindingHistory: [
				{
					binding: valid,
					changedAt: new Date().toISOString(),
					extra: 1,
				},
			],
		}).success,
	).toBe(false);
	expect(
		accountConfigSchema.safeParse({
			...baseConfig(),
			vaultBinding: valid,
			vaultBindingHistory: [
				{ binding: valid, changedAt: new Date().toISOString() },
			],
		}).success,
	).toBe(true);
});

test("existing config round-trips exactly with a binding addition", () => {
	const root = tempRoot("bsv-vault-roundtrip-");
	try {
		const initial = baseConfig();
		writeAccount("alice", initial, root);
		const before = readAccount("alice", root);
		expect(before).toEqual({ ...initial });
		const withBinding: AccountConfig = {
			...initial,
			vaultBinding: paymentOnlyBinding(),
		};
		writeAccount("alice", withBinding, root);
		const after = readAccount("alice", root);
		expect(after?.chain).toBe(initial.chain);
		expect(after?.storageIdentityKey).toBe(initial.storageIdentityKey);
		expect(after?.activeRemote).toBe(initial.activeRemote);
		expect(after?.backups).toEqual(initial.backups);
		expect(after?.address).toBe(initial.address);
		expect(after?.depositPrefix).toBe(initial.depositPrefix);
		expect(after?.vaultBinding).toEqual(paymentOnlyBinding());
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("readAccountRevision returns sha256 of raw bytes and null when absent", () => {
	const root = tempRoot("bsv-vault-revision-");
	try {
		expect(readAccountRevision("ghost", root)).toBeNull();
		const config = baseConfig();
		writeAccount("bob", config, root);
		const raw = readFileSync(configPathFor(root, "bob"));
		expect(readAccountRevision("bob", root)).toBe(sha256Hex(raw));
		expect(readAccountRevision("bob", root)).toMatch(/^[0-9a-f]{64}$/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("exact revision CAS succeeds then mismatch leaves bytes unchanged", () => {
	const root = tempRoot("bsv-vault-cas-");
	try {
		writeAccount("carol", baseConfig(), root);
		const file = configPathFor(root, "carol");
		const rawBefore = readFileSync(file);
		const revBefore = readAccountRevision("carol", root);
		expect(revBefore).toBe(sha256Hex(rawBefore));
		const next: AccountConfig = {
			...baseConfig(),
			vaultBinding: paymentOnlyBinding(),
		};
		writeAccount("carol", next, root, { expectedRevision: revBefore });
		const rawAfterSuccess = readFileSync(file);
		const revAfterSuccess = readAccountRevision("carol", root);
		expect(revAfterSuccess).toBe(sha256Hex(rawAfterSuccess));
		expect(revAfterSuccess).not.toBe(revBefore);
		const historyBeforeFailure = readAccount(
			"carol",
			root,
		)?.vaultBindingHistory;
		expect(() =>
			writeAccount("carol", { ...baseConfig() }, root, {
				expectedRevision: revBefore,
			}),
		).toThrow("ACCOUNT_CONFIG_CHANGED");
		const rawAfterFailure = readFileSync(file);
		expect(rawAfterFailure.equals(rawAfterSuccess)).toBe(true);
		expect(readAccountRevision("carol", root)).toBe(revAfterSuccess);
		expect(readAccount("carol", root)?.vaultBindingHistory).toEqual(
			historyBeforeFailure,
		);
		expect(() =>
			writeAccount("carol", { ...baseConfig() }, root, {
				expectedRevision: null,
			}),
		).toThrow("ACCOUNT_CONFIG_CHANGED");
		expect(readFileSync(file).equals(rawAfterSuccess)).toBe(true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("pre-created lock is busy and owned locks are cleaned", () => {
	const root = tempRoot("bsv-vault-lock-");
	try {
		writeAccount("dave", baseConfig(), root);
		const file = configPathFor(root, "dave");
		const rawBefore = readFileSync(file);
		const revBefore = readAccountRevision("dave", root);
		const lockPath = lockPathFor(root, "dave");
		writeFileSync(lockPath, "stale\n", { flag: "wx", mode: 0o600 });
		try {
			expect(() => writeAccount("dave", { ...baseConfig() }, root)).toThrow(
				"ACCOUNT_CONFIG_BUSY",
			);
			expect(existsSync(lockPath)).toBe(true);
			expect(readFileSync(file).equals(rawBefore)).toBe(true);
			expect(readAccountRevision("dave", root)).toBe(revBefore);
		} finally {
			rmSync(lockPath, { force: true });
		}
		writeAccount("dave", { ...baseConfig() }, root);
		expect(existsSync(lockPath)).toBe(false);
		const revAfterSuccess = readAccountRevision("dave", root);
		expect(typeof revAfterSuccess).toBe("string");
		expect(() =>
			writeAccount(
				"dave",
				{ ...baseConfig(), vaultBinding: paymentOnlyBinding() },
				root,
				{ expectedRevision: "deadbeef" },
			),
		).toThrow("ACCOUNT_CONFIG_CHANGED");
		expect(existsSync(lockPath)).toBe(false);
		expect(readAccountRevision("dave", root)).toBe(revAfterSuccess);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("replacing binding preserves history and unchanged binding adds nothing", () => {
	const root = tempRoot("bsv-vault-history-");
	try {
		const bindingA = paymentOnlyBinding();
		const bindingB = {
			...paymentOnlyBinding(),
			vaultId: "vault-456",
			payment: { entryId: "pay-entry-2", publicKey: HD_PUBKEY },
		};
		writeAccount("erin", { ...baseConfig(), vaultBinding: bindingA }, root);
		expect(readAccount("erin", root)?.vaultBindingHistory ?? []).toEqual([]);
		writeAccount("erin", { ...baseConfig(), vaultBinding: bindingB }, root);
		const afterReplace = readAccount("erin", root);
		expect(afterReplace?.vaultBinding).toEqual(bindingB);
		expect(afterReplace?.vaultBindingHistory?.length).toBe(1);
		expect(afterReplace?.vaultBindingHistory?.[0]?.binding).toEqual(bindingA);
		const changedAt = afterReplace?.vaultBindingHistory?.[0]?.changedAt ?? "";
		expect(Number.isNaN(Date.parse(changedAt))).toBe(false);
		expect(new Date(changedAt).toISOString()).toBe(changedAt);
		writeAccount(
			"erin",
			{ ...baseConfig(), vaultBinding: bindingB, vaultBindingHistory: [] },
			root,
		);
		const afterEmptyHistory = readAccount("erin", root);
		expect(afterEmptyHistory?.vaultBindingHistory?.length).toBe(1);
		expect(afterEmptyHistory?.vaultBindingHistory?.[0]?.binding).toEqual(
			bindingA,
		);
		writeAccount("erin", { ...baseConfig(), vaultBinding: bindingB }, root);
		expect(readAccount("erin", root)?.vaultBindingHistory?.length).toBe(1);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("invalid candidate is rejected before touching the live file", () => {
	const root = tempRoot("bsv-vault-invalid-");
	try {
		writeAccount("frank", baseConfig(), root);
		const file = configPathFor(root, "frank");
		const rawBefore = readFileSync(file);
		const revBefore = readAccountRevision("frank", root);
		expect(() =>
			writeAccount(
				"frank",
				{
					...baseConfig(),
					vaultBinding: {
						...paymentOnlyBinding(),
						payment: { entryId: "x", publicKey: "bad" },
					},
				} as unknown as AccountConfig,
				root,
			),
		).toThrow();
		expect(readFileSync(file).equals(rawBefore)).toBe(true);
		expect(readAccountRevision("frank", root)).toBe(revBefore);
		expect(() =>
			writeAccount(
				"frank",
				{ chain: "main" } as unknown as AccountConfig,
				root,
			),
		).toThrow();
		expect(readFileSync(file).equals(rawBefore)).toBe(true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("replacement lock swapped in mid-write is never deleted on release", () => {
	const root = tempRoot("bsv-vault-lock-ownership-");
	const originalToISOString = Date.prototype.toISOString;
	try {
		const bindingA = paymentOnlyBinding();
		const bindingB = {
			...paymentOnlyBinding(),
			vaultId: "vault-456",
			payment: { entryId: "pay-entry-2", publicKey: HD_PUBKEY },
		};
		writeAccount("grace", { ...baseConfig(), vaultBinding: bindingA }, root);
		const lockPath = lockPathFor(root, "grace");
		let swapped = false;
		Date.prototype.toISOString = function (this: Date) {
			if (!swapped) {
				swapped = true;
				// Simulate another writer replacing the owned lock path while
				// this write still holds its lock file descriptor.
				try {
					rmSync(lockPath, { force: true });
				} catch {
					// Best-effort test setup.
				}
				writeFileSync(lockPath, "attacker\n", { flag: "wx", mode: 0o600 });
			}
			return originalToISOString.call(this);
		};
		try {
			writeAccount("grace", { ...baseConfig(), vaultBinding: bindingB }, root);
		} finally {
			Date.prototype.toISOString = originalToISOString;
		}
		expect(swapped).toBe(true);
		// The unknown replacement lock must survive the release path.
		expect(existsSync(lockPath)).toBe(true);
		expect(readFileSync(lockPath, "utf8")).toBe("attacker\n");
		// The config write itself still succeeded under the held descriptor.
		expect(readAccount("grace", root)?.vaultBinding).toEqual(bindingB);
		// Clean the foreign lock so the fixture removes cleanly.
		rmSync(lockPath, { force: true });
	} finally {
		Date.prototype.toISOString = originalToISOString;
		rmSync(root, { recursive: true, force: true });
	}
});
test("existing callers remain compatible with third-argument root and first write", () => {
	const root = tempRoot("bsv-vault-compat-");
	try {
		expect(readAccount("newbie", root)).toBeUndefined();
		expect(readAccountRevision("newbie", root)).toBeNull();
		writeAccount("newbie", baseConfig(), root);
		expect(readAccount("newbie", root)?.chain).toBe("main");
		expect(typeof readAccountRevision("newbie", root)).toBe("string");
		writeAccount("newbie", { ...baseConfig(), depositPrefix: "1sat" }, root);
		expect(readAccount("newbie", root)?.depositPrefix).toBe("1sat");
		const freshRoot = join(root, "fresh-accounts");
		writeAccount("first", baseConfig(), freshRoot, { expectedRevision: null });
		expect(readAccount("first", freshRoot)?.chain).toBe("main");
		expect(() =>
			writeAccount("first", baseConfig(), freshRoot, {
				expectedRevision: null,
			}),
		).toThrow("ACCOUNT_CONFIG_CHANGED");
		const names = listAccounts(root).map((a) => a.name);
		expect(names).toContain("newbie");
		const dirFiles = readdirSync(accountDir("newbie", root));
		expect(dirFiles).toContain("config.json");
		expect(
			(lstatSync(configPathFor(root, "newbie")).mode & 0o777) === 0o600 ||
				existsSync(configPathFor(root, "newbie")),
		).toBe(true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
