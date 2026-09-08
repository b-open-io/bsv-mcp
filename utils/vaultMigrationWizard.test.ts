import { expect, test } from "bun:test";
import type { MigrationInventory, MigrationSource } from "./vaultMigration";
import {
	CUTOVER_CONFIRMATION,
	type MigrationPreview,
	type VaultMigrationBackend,
	type VaultMigrationDestination,
	VaultMigrationWizard,
} from "./vaultMigrationWizard";

const source: MigrationSource = {
	account: "legacy",
	location: "legacy-root",
	encryptedBackup: false,
	plaintextKeys: true,
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
	vaultPath: "/tmp/vault.bep",
	vaultEntryId: "payment-entry",
	expectedPublicKey: "02destination",
};

function preview(
	conflicts: MigrationPreview["conflicts"] = [],
): MigrationPreview {
	return {
		source: {
			account: source.account,
			location: source.location,
			identity: "identity-1",
			addresses: ["1source"],
			databaseFiles: source.walletDatabases,
		},
		destination: {
			accountName: destination.accountName,
			vaultPath: destination.vaultPath,
			vaultEntryId: destination.vaultEntryId,
			identity: "identity-1",
			addresses: ["1source"],
			existingVaultEntries: [],
		},
		preservation: {
			identity: "match",
			addresses: "match",
			databases: ["wallet.db"],
			vaultEntries: "retain",
		},
		conflicts,
	};
}

function backend(
	overrides: Partial<VaultMigrationBackend> = {},
): VaultMigrationBackend {
	return {
		available: true,
		beginUnlock: async (input) => ({
			sessionId: `session-${input.sourcePassphrase}`,
			expiresAt: 10_000,
			vaultPath: input.vaultPath,
			vaultEntryId: input.vaultEntryId,
			publicKey: "02destination",
		}),
		preview: async () => preview(),
		cutover: async () => ({
			completed: true,
			verified: true,
			accountName: "legacy",
			preserved: {
				identity: true,
				addresses: true,
				databases: ["wallet.db"],
				vaultEntries: [],
			},
		}),
		lock: async () => {},
		...overrides,
	};
}

async function selectedWizard(
	backendOverride: VaultMigrationBackend = backend(),
	now: () => number = () => 1_000,
) {
	const wizard = new VaultMigrationWizard({
		inventory,
		backend: backendOverride,
		now,
	});
	wizard.selectSource("legacy-root:legacy");
	wizard.selectDestination(destination);
	return wizard;
}

test("backend availability is explicit and unavailable actions remain blocked", async () => {
	const wizard = new VaultMigrationWizard({
		inventory,
		backend: {
			...backend(),
			available: false,
			unavailableReason: "Vault adapter is not installed",
		},
	});
	expect(wizard.snapshot().backend).toEqual({
		available: false,
		reason: "Vault adapter is not installed",
	});
	wizard.selectSource(source);
	wizard.selectDestination(destination);
	const state = await wizard.unlock("secret that stays out of state");
	expect(state.error?.code).toBe("backend-unavailable");
	expect(state.backend.available).toBe(false);
	expect(JSON.stringify(state)).not.toContain("secret that stays out of state");
});

test("unlock accepts an in-memory secret, then shows preservation preview", async () => {
	const observedSecrets: string[] = [];
	const wizard = await selectedWizard(
		backend({
			beginUnlock: async (input) => {
				observedSecrets.push(input.sourcePassphrase);
				return {
					sessionId: "session-1",
					expiresAt: 10_000,
					vaultPath: input.vaultPath,
					vaultEntryId: input.vaultEntryId,
					publicKey: "02destination",
				};
			},
		}),
	);
	const state = await wizard.unlock("local-only-secret");
	expect(observedSecrets).toEqual(["local-only-secret"]);
	expect(state.phase).toBe("ready");
	expect(state.preview?.preservation).toMatchObject({
		identity: "match",
		addresses: "match",
		databases: ["wallet.db"],
	});
	expect(JSON.stringify(state)).not.toContain("local-only-secret");
});

test("backend metadata is projected to public fields and sensitive errors are redacted", async () => {
	const wizard = await selectedWizard(
		backend({
			beginUnlock: async (input) =>
				({
					sessionId: "session-1",
					expiresAt: 10_000,
					vaultPath: input.vaultPath,
					vaultEntryId: input.vaultEntryId,
					publicKey: "02destination",
					privateKey: "should-never-reach-state",
				}) as never,
			preview: async () =>
				({
					...preview(),
					secret: "should-never-reach-state",
				}) as never,
		}),
	);
	const state = await wizard.unlock("local-secret");
	expect(state.phase).toBe("ready");
	expect(JSON.stringify(state)).not.toContain("should-never-reach-state");

	const failing = await selectedWizard(
		backend({
			beginUnlock: async () => {
				throw new Error("passphrase local-secret");
			},
		}),
	);
	const failed = await failing.unlock("local-secret");
	expect(failed.error?.message).toBe(
		"Vault migration failed. No cutover was confirmed.",
	);
	expect(JSON.stringify(failed)).not.toContain("local-secret");
});

test("existing Vault conflicts require a resolution before explicit cutover", async () => {
	const conflict = {
		id: "entry-1",
		kind: "vault-entry" as const,
		message: "Vault entry already exists",
	};
	const wizard = await selectedWizard(
		backend({ preview: async () => preview([conflict]) }),
	);
	let state = await wizard.unlock("passphrase");
	expect(state.phase).toBe("conflict-review");
	state = wizard.confirmCutover(CUTOVER_CONFIRMATION);
	expect(state.error?.code).toBe("conflict");
	state = wizard.resolveConflict("entry-1", "keep-existing");
	expect(state.phase).toBe("ready");
	state = wizard.confirmCutover(CUTOVER_CONFIRMATION);
	expect(state.cutoverConfirmed).toBe(true);
	state = await wizard.cutover();
	expect(state.phase).toBe("complete");
	expect(state.result?.verified).toBe(true);
});

test("cutover emits progress and requires the exact confirmation phrase", async () => {
	const progress: string[] = [];
	const wizard = await selectedWizard(
		backend({
			cutover: async (_input, onProgress) => {
				onProgress?.({
					stage: "verify",
					completed: 3,
					total: 4,
					message: "Verifying addresses",
				});
				return {
					completed: true,
					verified: true,
					accountName: "legacy",
					preserved: {
						identity: true,
						addresses: true,
						databases: [],
						vaultEntries: [],
					},
				};
			},
		}),
	);
	wizard.subscribe((state) => {
		if (state.progress) progress.push(state.progress.message);
	});
	await wizard.unlock("passphrase");
	let state = wizard.confirmCutover("yes");
	expect(state.error?.code).toBe("cutover-not-confirmed");
	state = wizard.confirmCutover(CUTOVER_CONFIRMATION);
	state = await wizard.cutover();
	expect(state.phase).toBe("complete");
	expect(progress).toContain("Verifying addresses");
});

test("expiry, locking, interruption, retry, and recovery are visible states", async () => {
	let current = 1_000;
	const wizard = await selectedWizard(backend(), () => current);
	await wizard.unlock("passphrase");
	current = 20_000;
	let state = await wizard.loadPreview();
	expect(state.phase).toBe("expired");
	state = await wizard.retry();
	expect(state.phase).toBe("destination");
	await wizard.unlock("passphrase");
	state = await wizard.lock();
	expect(state.phase).toBe("locked");
	state = wizard.interrupt();
	expect(state.phase).toBe("interrupted");
	state = await wizard.retry();
	expect(state.phase).toBe("interrupted");
});

test("recovery can reopen selection only after the backend proves cutover is safe", async () => {
	const wizard = await selectedWizard(
		backend({ reconcile: async () => ({ status: "safe-to-retry" }) }),
	);
	await wizard.unlock("passphrase");
	wizard.interrupt();
	const state = await wizard.retry();
	expect(state.phase).toBe("destination");
	expect(state.session).toBeUndefined();
});

test("a stale unlock cannot restore a source after the user changes selection", async () => {
	let release!: (session: {
		sessionId: string;
		expiresAt: number;
		vaultPath: string;
		vaultEntryId: string;
		publicKey?: string;
	}) => void;
	const pending = new Promise<{
		sessionId: string;
		expiresAt: number;
		vaultPath: string;
		vaultEntryId: string;
		publicKey?: string;
	}>((resolve) => {
		release = resolve;
	});
	const locks: string[] = [];
	const wizard = new VaultMigrationWizard({
		inventory: {
			...inventory,
			sources: [source, { ...source, account: "other" }],
		},
		backend: backend({
			beginUnlock: async () => pending,
			lock: async (sessionId) => {
				locks.push(sessionId);
			},
		}),
	});
	wizard.selectSource("legacy-root:legacy");
	wizard.selectDestination(destination);
	const unlock = wizard.unlock("passphrase");
	wizard.selectSource("legacy-root:other");
	wizard.selectDestination({ ...destination, accountName: "other" });
	release({
		sessionId: "stale-session",
		expiresAt: 10_000,
		vaultPath: destination.vaultPath,
		vaultEntryId: destination.vaultEntryId,
		publicKey: destination.expectedPublicKey,
	});
	await unlock;
	const state = wizard.snapshot();
	expect(state.source?.account).toBe("other");
	expect(state.session).toBeUndefined();
	expect(locks).toEqual(["stale-session"]);
});

test("cutover is single flight and an unknown outcome enters recovery", async () => {
	let release!: (value: never) => void;
	const pending = new Promise<never>((_, reject) => {
		release = reject;
	});
	let calls = 0;
	const wizard = await selectedWizard(
		backend({
			cutover: async () => {
				calls += 1;
				return pending;
			},
		}),
	);
	await wizard.unlock("passphrase");
	wizard.confirmCutover(CUTOVER_CONFIRMATION);
	const first = wizard.cutover();
	const second = wizard.cutover();
	const secondState = await second;
	expect(secondState.phase).toBe("cutover");
	release(new Error("network status unavailable") as never);
	const firstState = await first;
	expect(firstState.phase).toBe("interrupted");
	expect(calls).toBe(1);
	const repeated = await wizard.cutover();
	expect(repeated.phase).toBe("interrupted");
});
