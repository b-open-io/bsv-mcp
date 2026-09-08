import { afterEach, describe, expect, it } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { HD, PrivateKey } from "@bsv/sdk";
import { writeAccount } from "./accounts";
import { SecureKeyManager } from "./keyManager";
import { loadProjectRoleBindings } from "./projectRoleBindingsStore";
import { createAccountVaultMigrationBackend } from "./vaultMigrationBackend";
import {
	canonicalMigrationPath,
	type MigrationJournalContext,
	releaseAbandonedMigrationLock,
} from "./vaultMigrationJournal";
import type {
	VaultMigrationCutoverRequest,
	VaultMigrationUnlockRequest,
} from "./vaultMigrationWizard";

// The integration runner points this at the checked-out Vault package. Keeping
// the package optional lets the unit suite run on machines without Vault.
const specifier = process.env.BSV_VAULT_TEST_MODULE ?? "@opl.dev/vault";
const actual = await import(specifier).catch(() => undefined);
const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});

const payment = PrivateKey.fromHex("1");
const identity = PrivateKey.fromHex("2");

async function fixture() {
	const root = mkdtempSync(join(tmpdir(), "vault-restart-recovery-"));
	roots.push(root);
	const accounts = join(root, "accounts");
	const project = join(root, "project");
	const vaultPath = join(root, "vault", "keys.bep");
	mkdirSync(project);
	const sourceDir = join(accounts, "selected");
	await new SecureKeyManager({ keyDir: sourceDir }).saveKeys(
		{
			payPk: payment,
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
	const input = {
		accountName: "selected",
		vaultPath,
		vaultEntryId: "new",
		source,
		sourcePassphrase: "source-password",
		destinationPassphrase: "destination-password",
	} as VaultMigrationUnlockRequest;
	return {
		root,
		accounts,
		project,
		sourceDir,
		vaultPath,
		options,
		source,
		destination,
		input,
	};
}

function request(
	sessionId: string,
	f: Awaited<ReturnType<typeof fixture>>,
): VaultMigrationCutoverRequest {
	return {
		sessionId,
		source: f.source,
		destination: f.destination,
		confirmation: "MIGRATE_AND_SWITCH",
		resolutions: {},
	};
}

function emptyProjectBindings() {
	return {
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
	};
}

function migrationArtifacts(vaultPath: string) {
	return readdirSync(dirname(vaultPath)).filter((name) =>
		name.startsWith(".vault-migration-"),
	);
}

function migrationStageDirectories(vaultPath: string) {
	return migrationArtifacts(vaultPath).filter(
		(name) => !name.endsWith(".json"),
	);
}

/**
 * These tests intentionally use the actual encrypted Vault implementation and
 * the same generated fixture keys as vaultMigrationBackend.test.ts. They never
 * read or inject a user's key material.
 */
describe.skipIf(!actual)("Vault migration restart recovery", () => {
	it("removes staging directories and the migration lock after verified success", async () => {
		const f = await fixture();
		const backend = await createAccountVaultMigrationBackend(f.options);
		const session = await backend.beginUnlock(f.input);

		const result = await backend.cutover(request(session.sessionId, f));

		expect(result).toMatchObject({ completed: true, verified: true });
		expect(migrationStageDirectories(f.vaultPath)).toEqual([]);
		const receipts = migrationArtifacts(f.vaultPath).filter((name) =>
			name.endsWith(".json"),
		);
		expect(receipts).toHaveLength(1);
		expect(
			JSON.parse(readFileSync(join(dirname(f.vaultPath), receipts[0]), "utf8"))
				.phase,
		).toBe("complete");
		expect(existsSync(`${f.vaultPath}.lock`)).toBe(false);
		// The migration preserves the recoverable encrypted source.
		expect(existsSync(join(f.sourceDir, "keys.bep"))).toBe(true);
		await backend.lock(session.sessionId);
	});

	it("restarts into explicit manual recovery after activation and project CAS", async () => {
		const f = await fixture();
		const first = await createAccountVaultMigrationBackend(f.options);
		const firstSession = await first.beginUnlock(f.input);
		const firstRequest = request(firstSession.sessionId, f);

		// The callback runs immediately before activation. Changing the project
		// document there makes the subsequent CAS fail after the encrypted Vault
		// has been activated, which is the crash window the journal must cover.
		await expect(
			first.cutover(firstRequest, (progress) => {
				if (progress.stage === "cutover")
					writeFileSync(
						join(f.project, ".bsv-mcp.json"),
						JSON.stringify(emptyProjectBindings()),
					);
			}),
		).rejects.toMatchObject({ code: "MIGRATION_FAILED" });

		expect(existsSync(f.vaultPath)).toBe(true);
		const activatedVault = readFileSync(f.vaultPath);
		const staged = migrationStageDirectories(f.vaultPath);
		expect(staged.length).toBeGreaterThan(0);

		// A process crash occurs before the lock cleanup. The operation reference
		// is durable and contains no key, passphrase, or plaintext entry.
		const receiptName = migrationArtifacts(f.vaultPath).find((name) =>
			name.endsWith(".json"),
		);
		expect(receiptName).toBeDefined();
		const receipt = JSON.parse(
			readFileSync(join(dirname(f.vaultPath), receiptName as string), "utf8"),
		) as { sessionId: string; phase: string };
		expect(receipt.sessionId).toBe(firstSession.sessionId);
		expect(receipt.phase).toBe("vault-activated");

		// A process crash occurs before lock cleanup. The receipt's session UUID
		// is the public durable recovery reference; the lock carries no secret.
		writeFileSync(
			`${f.vaultPath}.lock`,
			JSON.stringify({
				pid: 99_999_999,
				at: Date.now(),
				sessionId: firstSession.sessionId,
			}),
			{ mode: 0o600 },
		);

		// Constructing a second backend resets all in-memory session/outcome maps.
		// Reconcile uses the durable session UUID from the receipt, not a newly
		// invented session that could import the source a second time.
		const restarted = await createAccountVaultMigrationBackend(f.options);
		const reconciliation = await restarted.reconcile?.({
			sessionId: firstSession.sessionId,
			source: f.source,
			destination: f.destination,
		});

		// Unknown is a deliberate manual-recovery stop. A fresh process must not
		// classify an interrupted activation as safe-to-retry or emit raw EEXIST.
		expect(reconciliation?.status).toBe("unknown");
		expect(reconciliation?.status).not.toBe("safe-to-retry");
		expect(receipt.sessionId).toBe(firstSession.sessionId);
		expect(JSON.stringify(reconciliation)).not.toContain("source-password");
		expect(JSON.stringify(reconciliation)).not.toContain(
			"destination-password",
		);
		expect(JSON.stringify(reconciliation)).not.toContain(payment.toWif());
		expect(JSON.stringify(reconciliation)).not.toContain(identity.toWif());

		// Reconcile is read-only: no duplicate import or destination cutover took
		// place while the new backend inspected the durable crash state.
		expect(readFileSync(f.vaultPath)).toEqual(activatedVault);
		const vault = await actual.openVault(
			f.vaultPath,
			new actual.PassphraseProvider("destination-password"),
		);
		expect(vault.list()).toHaveLength(3);
		vault.lock();
		expect(
			(await loadProjectRoleBindings(f.project, "project"))?.bindings,
		).toHaveLength(0);
		expect(existsSync(`${f.vaultPath}.lock`)).toBe(true);

		// Unknown never authorizes an automatic retry. Clearing the abandoned lock
		// requires the explicit local operator confirmation and the matching receipt.
		await releaseAbandonedMigrationLock(
			{
				projectRoot: canonicalMigrationPath(f.project),
				projectId: "project",
				vaultPath: canonicalMigrationPath(f.vaultPath),
				sessionId: firstSession.sessionId,
				accountName: "selected",
			} satisfies MigrationJournalContext,
			"RELEASE_ABANDONED_MIGRATION_LOCK",
		);
		expect(existsSync(`${f.vaultPath}.lock`)).toBe(false);
		await first.lock(firstSession.sessionId);
	});
});
