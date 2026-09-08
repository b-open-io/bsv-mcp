import { expect, test } from "bun:test";
import {
	inspectMigration,
	type MigrationInventory,
	type MigrationSource,
} from "./vaultMigration";
import type {
	MigrationReconciliation,
	MigrationPreview,
	MigrationProgress,
	VaultMigrationBackend,
	VaultMigrationCutoverResult,
	VaultMigrationDestination,
	VaultMigrationSession,
} from "./vaultMigrationWizard";
import { startVaultSetup } from "./vaultSetup";

const PLAINTEXT_MARKER = "synthetic-plaintext-must-never-persist";
const source: MigrationSource = {
	account: "legacy",
	location: "legacy-root",
	encryptedBackup: true,
	plaintextKeys: false,
	walletDatabases: ["wallet.db"],
};
const inventory: MigrationInventory = {
	sources: [source],
	vaultExists: true,
	environmentKeys: { payment: false, identity: false, empty: false },
	migrationRequired: true,
};
const destination: VaultMigrationDestination = {
	accountName: "legacy",
	vaultPath: "/tmp/synthetic-vault.bep",
	vaultEntryId: "payment-entry",
	expectedPublicKey: "02destination",
};

function migrationPreview(): MigrationPreview {
	return {
		source: {
			account: source.account,
			location: source.location,
			addresses: ["source-address"],
			databaseFiles: source.walletDatabases,
		},
		destination: {
			accountName: destination.accountName,
			vaultPath: destination.vaultPath,
			vaultEntryId: destination.vaultEntryId,
			addresses: ["source-address"],
			existingVaultEntries: [{ entryId: "existing-entry" }],
		},
		preservation: {
			identity: "match",
			addresses: "match",
			databases: ["wallet.db"],
			vaultEntries: "retain",
		},
		conflicts: [],
	};
}

const completeResult: VaultMigrationCutoverResult = {
	completed: true,
	verified: true,
	accountName: "legacy",
	preserved: {
		identity: true,
		addresses: true,
		databases: ["wallet.db"],
		vaultEntries: ["existing-entry"],
	},
};

class RouteRecoveryBackend implements VaultMigrationBackend {
	readonly available = true;
	readonly calls: string[] = [];
	readonly sourceBytes = Uint8Array.from([
		0x56, 0x42, 0x45, 0x50, 0x01, 0x7a, 0x11, 0xa4, 0x90, 0x2d, 0xc8, 0x6e,
	]);
	readonly existingEntryBytes = Uint8Array.from([
		0x56, 0x42, 0x45, 0x50, 0x01, 0x0a, 0xe2, 0x44, 0x6c, 0x19,
	]);
	durablyVerified = false;
	reconcileStatus: MigrationReconciliation["status"] = "unknown";
	sourceRetired = false;

	async beginUnlock(
		input: Parameters<VaultMigrationBackend["beginUnlock"]>[0],
	): Promise<VaultMigrationSession> {
		this.calls.push("unlock");
		if (input.sourcePassphrase.includes(PLAINTEXT_MARKER))
			throw new Error(input.sourcePassphrase);
		return {
			sessionId: "route-session",
			expiresAt: Date.now() + 60_000,
			vaultPath: input.vaultPath,
			vaultEntryId: input.vaultEntryId,
			publicKey: destination.expectedPublicKey,
		};
	}

	async preview(): Promise<MigrationPreview> {
		this.calls.push("preview");
		return migrationPreview();
	}

	async cutover(
		_input: Parameters<VaultMigrationBackend["cutover"]>[0],
		onProgress?: (progress: MigrationProgress) => void,
	): Promise<VaultMigrationCutoverResult> {
		this.calls.push("cutover");
		onProgress?.({
			stage: "verify",
			completed: 3,
			total: 4,
			message: "Verifying encrypted destination",
		});
		if (!this.durablyVerified)
			return {
				...completeResult,
				verified: false,
			} as unknown as VaultMigrationCutoverResult;
		this.sourceRetired = true;
		return completeResult;
	}

	async lock(_sessionId: string): Promise<void> {
		this.calls.push("lock");
	}

	async reconcile(): Promise<MigrationReconciliation> {
		this.calls.push("reconcile");
		return this.reconcileStatus === "complete"
			? { status: "complete", result: completeResult }
			: { status: this.reconcileStatus };
	}
}

function authHeaders(setup: { url: string }) {
	const url = new URL(setup.url);
	return {
		url,
		headers: { Authorization: `Bearer ${url.hash.slice(1)}` },
	};
}

async function post(setup: { url: string }, path: string, body: unknown) {
	const { url, headers } = authHeaders(setup);
	return fetch(`${url.origin}${path}`, {
		method: "POST",
		headers: { ...headers, "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

test("setup route reports unavailable capability and refuses migration writes", async () => {
	const setup = await startVaultSetup({
		inspect: () =>
			inspectMigration({ home: "/tmp/bsv-vault-missing-home", env: {} }),
	});
	try {
		const { url, headers } = authHeaders(setup);
		const capabilities = await fetch(
			`${url.origin}/api/migration/capabilities`,
			{
				headers,
			},
		);
		expect(await capabilities.json()).toMatchObject({ available: false });
		const attempt = await post(setup, "/api/migration/cutover", {
			confirmation: "MIGRATE_AND_SWITCH",
		});
		expect(attempt.status).toBe(503);
		expect(await attempt.json()).toEqual({
			error: "Vault migration backend is unavailable.",
		});
	} finally {
		await setup.close();
	}
});

test("setup route lock cancels before cutover and preserves the synthetic source", async () => {
	const backend = new RouteRecoveryBackend();
	const setup = await startVaultSetup({
		inspect: () => inventory,
		migrationBackend: backend,
	});
	try {
		const sourceBefore = backend.sourceBytes.slice();
		const unlocked = await post(setup, "/api/migration/unlock", {
			source,
			destination,
			sourcePassphrase: "route-local-passphrase",
		});
		expect(unlocked.status).toBe(200);
		const sessionId = (await unlocked.json()).session.sessionId;
		const locked = await post(setup, "/api/migration/lock", { sessionId });
		expect(locked.status).toBe(200);
		expect(await locked.json()).toEqual({ locked: true });

		const cutover = await post(setup, "/api/migration/cutover", {
			sessionId,
			confirmation: "MIGRATE_AND_SWITCH",
		});
		expect(cutover.status).toBe(409);
		expect(backend.sourceRetired).toBe(false);
		expect(backend.sourceBytes).toEqual(sourceBefore);
		expect(backend.calls).toEqual(["unlock", "preview", "lock"]);
		expect(JSON.stringify(await cutover.json())).not.toContain(
			PLAINTEXT_MARKER,
		);
	} finally {
		await setup.close();
	}
});

test("setup route blocks generic retry after an unverified cutover until reconciliation", async () => {
	const backend = new RouteRecoveryBackend();
	const setup = await startVaultSetup({
		inspect: () => inventory,
		migrationBackend: backend,
	});
	try {
		const sourceBefore = backend.sourceBytes.slice();
		const existingEntryBefore = backend.existingEntryBytes.slice();
		const unlocked = await post(setup, "/api/migration/unlock", {
			source,
			destination,
			sourcePassphrase: "route-local-passphrase",
		});
		expect(unlocked.status).toBe(200);
		const sessionId = (await unlocked.json()).session.sessionId;
		const failed = await post(setup, "/api/migration/cutover", {
			sessionId,
			confirmation: "MIGRATE_AND_SWITCH",
		});
		expect(failed.status).toBe(409);
		expect(await failed.json()).toEqual({
			error:
				"Cutover status is unknown. Check the local backup and Vault entries before retrying.",
		});
		expect(backend.sourceRetired).toBe(false);
		expect(backend.sourceBytes).toEqual(sourceBefore);
		expect(backend.existingEntryBytes).toEqual(existingEntryBefore);

		const genericRetry = await post(setup, "/api/migration/preview", {
			sessionId,
		});
		expect(genericRetry.status).toBe(409);
		expect(backend.calls).toEqual(["unlock", "preview", "cutover"]);

		const unknown = await post(setup, "/api/migration/reconcile", {
			sessionId,
		});
		expect(unknown.status).toBe(409);
		expect(await unknown.json()).toEqual({
			error:
				"Cutover status remains unknown. Keep the source and backup until it is reconciled.",
		});
		expect(backend.sourceRetired).toBe(false);

		backend.reconcileStatus = "safe-to-retry";
		const safeToRetry = await post(setup, "/api/migration/reconcile", {
			sessionId,
		});
		expect(safeToRetry.status).toBe(200);
		expect(await safeToRetry.json()).toEqual({ phase: "destination" });

		const unlockedAgain = await post(setup, "/api/migration/unlock", {
			source,
			destination,
			sourcePassphrase: "route-local-passphrase",
		});
		expect(unlockedAgain.status).toBe(200);
		const retrySessionId = (await unlockedAgain.json()).session.sessionId;
		backend.durablyVerified = true;
		const retried = await post(setup, "/api/migration/cutover", {
			sessionId: retrySessionId,
			confirmation: "MIGRATE_AND_SWITCH",
		});
		expect(retried.status).toBe(200);
		expect(await retried.json()).toEqual(completeResult);
		expect(backend.sourceRetired).toBe(true);
		expect(backend.existingEntryBytes).toEqual(existingEntryBefore);
		expect(backend.calls).toEqual([
			"unlock",
			"preview",
			"cutover",
			"reconcile",
			"reconcile",
			"unlock",
			"preview",
			"cutover",
		]);
	} finally {
		await setup.close();
	}
});
