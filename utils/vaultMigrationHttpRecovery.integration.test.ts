import { afterEach, describe, expect, it } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	realpathSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HD, PrivateKey } from "@bsv/sdk";
import { writeAccount } from "./accounts";
import { SecureKeyManager } from "./keyManager";
import { loadProjectRoleBindings } from "./projectRoleBindingsStore";
import { createAccountVaultMigrationBackend } from "./vaultMigrationBackend";
import { startVaultSetup } from "./vaultSetup";
import type {
	MigrationInventory,
	MigrationSource,
	VaultMigrationDestination,
} from "./vaultMigration";

// The real adapter is exercised when the locally installed Vault package is
// available. The fixture uses deterministic synthetic keys and passphrases.
const vaultModuleSpecifier =
	process.env.BSV_VAULT_TEST_MODULE ?? "@opl.dev/vault";
const vaultModule = await import(vaultModuleSpecifier).catch(() => undefined);
const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const source: MigrationSource = {
	account: "selected",
	location: "account",
	encryptedBackup: true,
	plaintextKeys: false,
	walletDatabases: ["wallet-test.db"],
};
const destination: VaultMigrationDestination = {
	accountName: "selected",
	vaultPath: "vault/keys.bep",
	vaultEntryId: "new",
};
const inventory: MigrationInventory = {
	sources: [source],
	vaultExists: false,
	environmentKeys: { payment: false, identity: false, empty: false },
	migrationRequired: true,
};
const roleSelection = {
	expectedProjectId: "project",
	expectedRevision: null,
	roleAssignments: {
		"identity-signing": "select:identity",
		payments: "select:payment",
		"one-sat": "select:payment",
		encryption: "select:identity",
	},
};

async function fixture() {
	const root = realpathSync(mkdtempSync(join(tmpdir(), "vault-http-recovery-")));
	roots.push(root);
	const accountsDirectory = join(root, "accounts");
	const sourceDirectory = join(accountsDirectory, source.account);
	const projectRoot = join(root, "project");
	mkdirSync(projectRoot);
	const vaultPath = join(root, destination.vaultPath);
	await new SecureKeyManager({ keyDir: sourceDirectory }).saveKeys(
		{
			payPk: PrivateKey.fromHex("1"),
			identityPk: PrivateKey.fromHex("2"),
			xprv: HD.fromSeed(new Array(32).fill(1)).toString(),
		},
		{ passphrase: "source-password" },
	);
	writeAccount(
		source.account,
		{ chain: "test", storageIdentityKey: "synthetic", depositPrefix: "mcp" },
		accountsDirectory,
	);
	const databasePath = join(sourceDirectory, "wallet-test.db");
	await Bun.write(databasePath, "synthetic-database-unchanged");
	const sourceFiles = Object.fromEntries(
		readdirSync(sourceDirectory).map((name) => [
			name,
			readFileSync(join(sourceDirectory, name)),
		]),
	);
	const backend = await createAccountVaultMigrationBackend({
		projectRoot,
		expectedProjectId: "project",
		vaultPath,
		accountsDirectory,
		roleAssignments: {},
		loadModule: async () => vaultModule,
	});
	return {
		root,
		projectRoot,
		sourceDirectory,
		vaultPath,
		sourceFiles,
		backend,
	};
}

function auth(setup: { url: string }) {
	const url = new URL(setup.url);
	return {
		url,
		headers: { Authorization: `Bearer ${url.hash.slice(1)}` },
	};
}

async function post(
	setup: { url: string },
	path: string,
	body: unknown,
) {
	const { url, headers } = auth(setup);
	return fetch(`${url.origin}${path}`, {
		method: "POST",
		headers: { ...headers, "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe.skipIf(!vaultModule)("real encrypted migration adapter over HTTP", () => {
	it("keeps the encrypted source recoverable when the local flow is cancelled", async () => {
		const f = await fixture();
		const setup = await startVaultSetup({
			inspect: () => inventory,
			migrationBackend: f.backend,
		});
		try {
			const unlocked = await post(setup, "/api/migration/unlock", {
				source,
				destination: { ...destination, vaultPath: f.vaultPath },
				sourcePassphrase: "source-password",
				destinationPassphrase: "destination-password",
			});
			expect(unlocked.status).toBe(200);
			const unlockBody = await unlocked.json();
			expect(JSON.stringify(unlockBody)).not.toContain("source-password");
			expect(JSON.stringify(unlockBody)).not.toContain("destination-password");
			const sessionId = unlockBody.session.sessionId;

			const locked = await post(setup, "/api/migration/lock", { sessionId });
			expect(locked.status).toBe(200);
			const cutover = await post(setup, "/api/migration/cutover", {
				sessionId,
				confirmation: "MIGRATE_AND_SWITCH",
			});
			expect(cutover.status).toBe(409);
			expect(await cutover.json()).toEqual({
				error: "The local unlock session is no longer active.",
		});
			for (const [name, bytes] of Object.entries(f.sourceFiles))
				expect(readFileSync(join(f.sourceDirectory, name))).toEqual(bytes);
			expect(() => statSync(f.vaultPath)).toThrow();
			expect(await loadProjectRoleBindings(f.projectRoot, "project")).toBeNull();
		} finally {
			await setup.close();
		}
	});

	it("switches only after the real backend reports durable encrypted verification", async () => {
		const f = await fixture();
		const setup = await startVaultSetup({
			inspect: () => inventory,
			migrationBackend: f.backend,
		});
		try {
			const unlocked = await post(setup, "/api/migration/unlock", {
				source,
				destination: { ...destination, vaultPath: f.vaultPath },
				sourcePassphrase: "source-password",
				destinationPassphrase: "destination-password",
			});
			expect(unlocked.status).toBe(200);
			const sessionId = (await unlocked.json()).session.sessionId;
			const result = await post(setup, "/api/migration/cutover", {
				sessionId,
				confirmation: "MIGRATE_AND_SWITCH",
				roleSelection,
			});
			expect(result.status).toBe(200);
			expect(await result.json()).toMatchObject({
				completed: true,
				verified: true,
				accountName: source.account,
			});
			for (const [name, bytes] of Object.entries(f.sourceFiles))
				expect(readFileSync(join(f.sourceDirectory, name))).toEqual(bytes);
			const encryptedDestination = readFileSync(f.vaultPath, "utf8");
			expect(encryptedDestination).not.toContain("source-password");
			expect(encryptedDestination).not.toContain("destination-password");
			expect(
				(await loadProjectRoleBindings(f.projectRoot, "project"))?.bindings,
			).toHaveLength(4);
		} finally {
			await setup.close();
		}
	});

	it("requires real backend reconciliation before retrying an uncertain HTTP cutover", async () => {
		const f = await fixture();
		const setup = await startVaultSetup({
			inspect: () => inventory,
			migrationBackend: f.backend,
		});
		try {
			const unlocked = await post(setup, "/api/migration/unlock", {
				source,
				destination: { ...destination, vaultPath: f.vaultPath },
				sourcePassphrase: "source-password",
				destinationPassphrase: "destination-password",
			});
			expect(unlocked.status).toBe(200);
			const sessionId = (await unlocked.json()).session.sessionId;

			// A project config appearing after preview forces the real adapter to
			// stop after durable staging, before activation. Restore the original
			// precondition before asking the backend to reconcile the journal.
			writeFileSync(
				join(f.projectRoot, ".bsv-mcp.json"),
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
			const failed = await post(setup, "/api/migration/cutover", {
				sessionId,
				confirmation: "MIGRATE_AND_SWITCH",
				roleSelection,
			});
			expect(failed.status).toBe(409);
			expect(failed.headers.get("content-type")).toContain("application/json");
			for (const [name, bytes] of Object.entries(f.sourceFiles))
				expect(readFileSync(join(f.sourceDirectory, name))).toEqual(bytes);
			expect(() => statSync(f.vaultPath)).toThrow();

			const replay = await post(setup, "/api/migration/cutover", {
				sessionId,
				confirmation: "MIGRATE_AND_SWITCH",
				roleSelection,
			});
			expect(replay.status).toBe(409);
			expect(failed.status).toBe(replay.status);
			for (const [name, bytes] of Object.entries(f.sourceFiles))
				expect(readFileSync(join(f.sourceDirectory, name))).toEqual(bytes);

			rmSync(join(f.projectRoot, ".bsv-mcp.json"), { force: true });
			const reconciled = await post(setup, "/api/migration/reconcile", {
				sessionId,
			});
			expect(reconciled.status).toBe(200);
			expect(await reconciled.json()).toEqual({ phase: "destination" });
			expect(() => statSync(f.vaultPath)).toThrow();
		} finally {
			await setup.close();
		}
	});
});
