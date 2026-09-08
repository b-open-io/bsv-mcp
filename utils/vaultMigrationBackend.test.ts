import { afterEach, describe, expect, it } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HD, PrivateKey } from "@bsv/sdk";
import { writeAccount } from "./accounts";
import { SecureKeyManager } from "./keyManager";
import { loadProjectRoleBindings } from "./projectRoleBindingsStore";
import { createAccountVaultMigrationBackend } from "./vaultMigrationBackend";
import type { VaultMigrationUnlockRequest } from "./vaultMigrationWizard";

// Optional integration fixture location is supplied only by the test runner.
// Production loading always resolves the installed @opl.dev/vault package.
const specifier = process.env.BSV_VAULT_TEST_MODULE ?? "@opl.dev/vault";
const actual = await import(specifier).catch(() => undefined);
const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});
const pay = PrivateKey.fromHex("1"),
	identity = PrivateKey.fromHex("2");
async function fixture() {
	const root = mkdtempSync(join(tmpdir(), "vault-real-migration-"));
	roots.push(root);
	const accounts = join(root, "accounts"),
		project = join(root, "project"),
		vaultPath = join(root, "vault", "keys.bep");
	mkdirSync(project);
	const sourceDir = join(accounts, "selected");
	await new SecureKeyManager({ keyDir: sourceDir }).saveKeys(
		{
			payPk: pay,
			identityPk: identity,
			xprv: HD.fromSeed(new Array(32).fill(1)).toString(),
		},
		{ passphrase: "source-password" },
	);
	writeAccount(
		"selected",
		{ chain: "test", storageIdentityKey: "synthetic", depositPrefix: "mcp" },
		accounts,
	);
	writeFileSync(
		join(sourceDir, "wallet-test.db"),
		"synthetic-database-unchanged",
	);
	const options = {
		projectRoot: project,
		expectedProjectId: "project",
		vaultPath,
		accountsDirectory: accounts,
		roleAssignments: {
			payments: "payment" as const,
			"identity-signing": "identity" as const,
		},
		loadModule: async () => actual,
	};
	const input = {
		accountName: "selected",
		vaultPath,
		vaultEntryId: "new",
		source: {
			account: "selected",
			location: "account",
			encryptedBackup: true,
			plaintextKeys: false,
			walletDatabases: ["wallet-test.db"],
		},
		sourcePassphrase: "source-password",
		destinationPassphrase: "destination-password",
	} as VaultMigrationUnlockRequest & {
		sourcePassphrase: string;
		destinationPassphrase: string;
	};
	const source = {
		account: "selected",
		location: "account" as const,
		encryptedBackup: true,
		plaintextKeys: false,
		walletDatabases: ["wallet-test.db"],
	};
	const destination = {
		accountName: "selected",
		vaultPath,
		vaultEntryId: "new",
	};
	return {
		root,
		sourceDir,
		project,
		vaultPath,
		options,
		input,
		source,
		destination,
	};
}
it("truthfully disables migration when its runtime package cannot load", async () => {
	const backend = await createAccountVaultMigrationBackend({
		projectRoot: "/synthetic/project",
		expectedProjectId: "project",
		vaultPath: "/synthetic/vault.bep",
		accountsDirectory: "/synthetic/accounts",
		roleAssignments: { payments: "payment" },
		loadModule: async () => {
			throw new Error("secret-in-error");
		},
	});
	expect(backend.available).toBe(false);
	expect(backend.unavailableReason).not.toContain("secret-in-error");
});
describe.skipIf(!actual)("actual Vault encrypted migration fixtures", () => {
	it("leaves verified Vault and original source recoverable if config CAS loses", async () => {
		const f = await fixture();
		const original = readFileSync(join(f.sourceDir, "keys.bep"));
		const backend = await createAccountVaultMigrationBackend(f.options);
		const session = await backend.beginUnlock(f.input);
		const request = {
			sessionId: session.sessionId,
			source: f.source,
			destination: f.destination,
			confirmation: "MIGRATE_AND_SWITCH" as const,
			resolutions: {},
		};
		await expect(
			backend.cutover(request, (progress) => {
				if (progress.stage === "cutover")
					writeFileSync(
						join(f.project, ".bsv-mcp.json"),
						JSON.stringify({
							roleBindings: {
								schemaVersion: 1,
								projectId: "project",
								revision: 0,
								current: {
									"identity-signing": null,
									payments: null,
									"one-sat": null,
									encryption: null,
								},
								bindings: [],
								retained: [],
							},
						}),
					);
			}),
		).rejects.toMatchObject({ code: "MIGRATION_FAILED" });
		expect(readFileSync(join(f.sourceDir, "keys.bep"))).toEqual(original);
		expect(
			(await loadProjectRoleBindings(f.project, "project"))?.bindings,
		).toHaveLength(0);
		const vault = await actual.openVault(
			f.vaultPath,
			new actual.PassphraseProvider("destination-password"),
		);
		expect(vault.list()).toHaveLength(3);
		vault.lock();
		expect(await backend.reconcile?.(request)).toEqual({ status: "unknown" });
		await backend.lock(session.sessionId);
	});
	it("migrates distinct credentials, retains all source data, verifies entries and first project config", async () => {
		const f = await fixture();
		const original = Object.fromEntries(
			readdirSync(f.sourceDir).map((name) => [
				name,
				readFileSync(join(f.sourceDir, name)),
			]),
		);
		const backend = await createAccountVaultMigrationBackend(f.options);
		expect(backend.available).toBe(true);
		const session = await backend.beginUnlock(f.input);
		const preview = await backend.preview({
			sessionId: session.sessionId,
			source: f.source,
			destination: f.destination,
		});
		expect(preview.preservation.identity).toBe("match");
		expect(readdirSync(f.root)).not.toContain("vault");
		const result = await backend.cutover({
			sessionId: session.sessionId,
			source: f.source,
			destination: f.destination,
			confirmation: "MIGRATE_AND_SWITCH",
			resolutions: {},
		});
		expect(result.verified).toBe(true);
		for (const [name, bytes] of Object.entries(original))
			expect(readFileSync(join(f.sourceDir, name))).toEqual(bytes);
		const config = await loadProjectRoleBindings(f.project, "project");
		expect(config?.revision).toBe(0);
		expect(config?.bindings).toHaveLength(2);
		expect(config?.current.encryption).toBeNull();
		const vault = await actual.openVault(
			f.vaultPath,
			new actual.PassphraseProvider("destination-password"),
		);
		const entries = vault.list();
		expect(entries.map((entry: { kind: string }) => entry.kind).sort()).toEqual(
			["hd-private", "wif", "wif"],
		);
		vault.unlock("synthetic verification");
		for (const binding of config?.bindings ?? [])
			expect(
				PrivateKey.fromWif(vault.reveal(binding.key.entryId, "test"))
					.toPublicKey()
					.toString(),
			).toBe(binding.key.expectedPublicKey);
		vault.lock();
		const disk = readFileSync(f.vaultPath, "utf8");
		expect(disk).not.toContain(pay.toWif());
		expect(disk).not.toContain(identity.toWif());
		expect(disk).not.toContain("destination-password");
	});
	it("preserves existing Vault entries exactly", async () => {
		const f = await fixture();
		const previous = await actual.createVault(f.vaultPath, [
			new actual.PassphraseProvider("destination-password"),
		]);
		previous.importPlain({ wif: PrivateKey.fromHex("3").toWif() }, "existing");
		await actual.saveVault(
			f.vaultPath,
			previous,
			new actual.PassphraseProvider("destination-password"),
		);
		const before = previous.toDocument().entries;
		previous.lock();
		const backend = await createAccountVaultMigrationBackend(f.options);
		const session = await backend.beginUnlock(f.input);
		await backend.cutover({
			sessionId: session.sessionId,
			source: f.source,
			destination: f.destination,
			confirmation: "MIGRATE_AND_SWITCH",
			resolutions: {},
		});
		const after = await actual.openVault(
			f.vaultPath,
			new actual.PassphraseProvider("destination-password"),
		);
		expect(after.toDocument().entries.slice(0, before.length)).toEqual(before);
		after.lock();
	});
	it("refuses changed databases before writing or assigning project roles", async () => {
		const f = await fixture();
		const backend = await createAccountVaultMigrationBackend(f.options);
		const session = await backend.beginUnlock(f.input);
		writeFileSync(join(f.sourceDir, "wallet-test.db"), "changed");
		await expect(
			backend.cutover({
				sessionId: session.sessionId,
				source: f.source,
				destination: f.destination,
				confirmation: "MIGRATE_AND_SWITCH",
				resolutions: {},
			}),
		).rejects.toMatchObject({ code: "SOURCE_CHANGED", noEffect: true });
		expect(await loadProjectRoleBindings(f.project, "project")).toBeNull();
		await backend.lock(session.sessionId);
	});
	it("does not mutate sources when destination encryption fails", async () => {
		const f = await fixture();
		const original = readFileSync(join(f.sourceDir, "keys.bep"));
		const backend = await createAccountVaultMigrationBackend({
			...f.options,
			loadModule: async () => ({
				...actual,
				saveVault: async () => {
					throw new Error(pay.toWif());
				},
			}),
		});
		const session = await backend.beginUnlock(f.input);
		await expect(
			backend.cutover({
				sessionId: session.sessionId,
				source: f.source,
				destination: f.destination,
				confirmation: "MIGRATE_AND_SWITCH",
				resolutions: {},
			}),
		).rejects.toMatchObject({ code: "MIGRATION_FAILED" });
		expect(readFileSync(join(f.sourceDir, "keys.bep"))).toEqual(original);
		expect(await loadProjectRoleBindings(f.project, "project")).toBeNull();
		await backend.lock(session.sessionId);
	});
	it("marks only fresh preflight errors as having no effect", async () => {
		const f = await fixture();
		const backend = await createAccountVaultMigrationBackend(f.options);
		const session = await backend.beginUnlock(f.input);
		const request = {
			sessionId: session.sessionId,
			source: f.source,
			destination: f.destination,
			confirmation: "MIGRATE_AND_SWITCH" as const,
			resolutions: {},
		};
		await expect(
			backend.cutover({ ...request, confirmation: "WRONG" as never }),
		).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED", noEffect: true });
		const error = await backend
			.cutover(request, () => {
				throw new Error("synthetic interruption after journal write");
			})
			.catch((error) => error);
		expect(error.noEffect).not.toBe(true);
		const retryError = await backend
			.cutover({ ...request, confirmation: "WRONG" as never })
			.catch((error) => error);
		expect(retryError.noEffect).not.toBe(true);
		await backend.lock(session.sessionId);
	});

	it("locks before cutover and rejects mismatched source accounts", async () => {
		const f = await fixture();
		const backend = await createAccountVaultMigrationBackend(f.options);
		const session = await backend.beginUnlock(f.input);
		await expect(
			backend.preview({
				sessionId: session.sessionId,
				source: { ...f.source, account: "other" },
				destination: f.destination,
			}),
		).rejects.toMatchObject({ code: "INVALID_SELECTION" });
		await backend.lock(session.sessionId);
		await expect(
			backend.cutover({
				sessionId: session.sessionId,
				source: f.source,
				destination: f.destination,
				confirmation: "MIGRATE_AND_SWITCH",
				resolutions: {},
			}),
		).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
	});
});
