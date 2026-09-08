import { expect, test } from "bun:test";
import type { MigrationInventory, MigrationSource } from "./vaultMigration";
import {
	CUTOVER_CONFIRMATION,
	type MigrationReconciliation,
	type MigrationPreview,
	type MigrationProgress,
	type VaultMigrationBackend,
	type VaultMigrationCutoverRequest,
	type VaultMigrationCutoverResult,
	type VaultMigrationDestination,
	type VaultMigrationSession,
	type VaultMigrationUnlockRequest,
	VaultMigrationWizard,
} from "./vaultMigrationWizard";

const PLAINTEXT_MARKER = "synthetic-plaintext-must-never-persist";
const SYNTHETIC_PASSPHRASE = "local-only-passphrase";
const SOURCE_BYTES = Uint8Array.from([
	0x56, 0x42, 0x45, 0x50, 0x01, 0x7a, 0x11, 0xa4, 0x90, 0x2d, 0xc8, 0x6e,
]);
const EXISTING_ENTRY_BYTES = Uint8Array.from([
	0x56, 0x42, 0x45, 0x50, 0x01, 0x0a, 0xe2, 0x44, 0x6c, 0x19,
]);

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

function preview(): MigrationPreview {
	return {
		source: {
			account: source.account,
			location: source.location,
			identity: "identity-1",
			addresses: ["source-address"],
			databaseFiles: source.walletDatabases,
		},
		destination: {
			accountName: destination.accountName,
			vaultPath: destination.vaultPath,
			vaultEntryId: destination.vaultEntryId,
			identity: "identity-1",
			addresses: ["source-address"],
			existingVaultEntries: [
				{ entryId: "existing-entry", publicKey: "02existing" },
			],
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

const successfulResult: VaultMigrationCutoverResult = {
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

/**
 * Synthetic local backend for the real wizard contract. It models an
 * encrypted source and existing destination entry without a real account,
 * passphrase, key, database, or live Vault service.
 */
class RecoveryBackend implements VaultMigrationBackend {
	readonly available = true;
	readonly calls: string[] = [];
	readonly sourceBytes = SOURCE_BYTES.slice();
	readonly existingEntryBytes = EXISTING_ENTRY_BYTES.slice();
	durablyVerified = false;
	reconcileStatus: MigrationReconciliation["status"] = "unknown";
	failUnlock = false;
	failPrecondition = false;
	failCutover = false;
	sourceRetired = false;

	async beginUnlock(
		input: VaultMigrationUnlockRequest,
	): Promise<VaultMigrationSession> {
		this.calls.push("unlock");
		if (this.failUnlock) throw new Error(`passphrase ${PLAINTEXT_MARKER}`);
		return {
			sessionId: "synthetic-session",
			expiresAt: 301_000,
			vaultPath: input.vaultPath,
			vaultEntryId: input.vaultEntryId,
			publicKey: destination.expectedPublicKey,
		};
	}

	async preview(
		_input: Parameters<VaultMigrationBackend["preview"]>[0],
	): Promise<MigrationPreview> {
		this.calls.push("preview");
		return preview();
	}

	async cutover(
		_input: VaultMigrationCutoverRequest,
		onProgress?: (progress: MigrationProgress) => void,
	): Promise<VaultMigrationCutoverResult> {
		this.calls.push("cutover");
		onProgress?.({
			stage: "verify",
			completed: 3,
			total: 4,
			message: "Verifying encrypted destination",
		});
		if (this.failPrecondition) {
			const error = new Error("Destination is unavailable before migration");
			// Only a trusted adapter may make this retryable: the marker states
			// that no destination write or source mutation occurred.
			Object.assign(error, { code: "PRECONDITION_FAILED", noEffect: true });
			throw error;
		}
		if (this.failCutover) throw new Error(`passphrase ${PLAINTEXT_MARKER}`);
		if (!this.durablyVerified)
			return {
				...successfulResult,
				verified: false,
			} as unknown as VaultMigrationCutoverResult;
		// Source retirement happens only after the synthetic backend has durably
		// verified the encrypted destination. Existing entries remain unchanged.
		this.sourceRetired = true;
		return successfulResult;
	}

	async lock(_sessionId: string): Promise<void> {
		this.calls.push("lock");
	}

	async reconcile(): Promise<MigrationReconciliation> {
		this.calls.push("reconcile");
		if (this.reconcileStatus === "complete")
			return { status: "complete", result: successfulResult };
		return { status: this.reconcileStatus };
	}

	sourceIsUsable(): boolean {
		return !this.sourceRetired && equalBytes(this.sourceBytes, SOURCE_BYTES);
	}
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

function unavailableBackend(): VaultMigrationBackend {
	return {
		available: false,
		unavailableReason: "Synthetic Vault adapter is unavailable",
		beginUnlock: async () => {
			throw new Error("must not be called");
		},
		preview: async () => {
			throw new Error("must not be called");
		},
		cutover: async () => {
			throw new Error("must not be called");
		},
		lock: async () => {
			throw new Error("must not be called");
		},
	};
}

async function selectedWizard(
	backend: VaultMigrationBackend,
): Promise<VaultMigrationWizard> {
	const wizard = new VaultMigrationWizard({
		inventory,
		backend,
		now: () => 1_000,
	});
	wizard.selectSource("legacy-root:legacy");
	wizard.selectDestination(destination);
	return wizard;
}

async function reviewedWizard(backend: RecoveryBackend) {
	const wizard = await selectedWizard(backend);
	const unlocked = await wizard.unlock({
		sourcePassphrase: SYNTHETIC_PASSPHRASE,
	});
	expect(unlocked.phase).toBe("ready");
	expect(wizard.confirmCutover(CUTOVER_CONFIRMATION).cutoverConfirmed).toBe(
		true,
	);
	return wizard;
}

function assertSanitized(state: unknown) {
	expect(JSON.stringify(state)).not.toContain(PLAINTEXT_MARKER);
	expect(JSON.stringify(state)).not.toContain(SYNTHETIC_PASSPHRASE);
}

test("backend-unavailable state blocks unlock and cutover without calling the backend", async () => {
	const backend = unavailableBackend();
	const wizard = await selectedWizard(backend);

	const unlockState = await wizard.unlock({
		sourcePassphrase: SYNTHETIC_PASSPHRASE,
	});
	expect(unlockState.phase).toBe("unlock");
	expect(unlockState.status).toBe("blocked");
	expect(unlockState.error?.code).toBe("backend-unavailable");
	const cutoverState = await wizard.cutover();
	expect(cutoverState.error?.code).toBe("backend-unavailable");
	assertSanitized(cutoverState);
});

test("backend unlock failure leaves the encrypted source usable and sanitizes the wizard state", async () => {
	const backend = new RecoveryBackend();
	backend.failUnlock = true;
	const wizard = await selectedWizard(backend);

	const state = await wizard.unlock(SYNTHETIC_PASSPHRASE);

	expect(state.phase).toBe("error");
	expect(state.status).toBe("failed");
	expect(state.error?.code).toBe("backend-error");
	expect(backend.sourceIsUsable()).toBe(true);
	expect(backend.calls).toEqual(["unlock"]);
	assertSanitized(state);
});

test("invalid verified result prevents success and preserves source and existing entries", async () => {
	const backend = new RecoveryBackend();
	const wizard = await reviewedWizard(backend);

	const state = await wizard.cutover();

	expect(state.phase).toBe("interrupted");
	expect(["blocked", "failed"]).toContain(state.status);
	expect(state.error?.code).toBe("interrupted");
	expect(state.error?.retryable).toBe(false);
	expect(state.result).toBeUndefined();
	expect(backend.sourceIsUsable()).toBe(true);
	expect(equalBytes(backend.existingEntryBytes, EXISTING_ENTRY_BYTES)).toBe(
		true,
	);
	expect(backend.calls).toEqual(["unlock", "preview", "cutover"]);
	assertSanitized(state);
	const replay = await wizard.cutover();
	expect(replay.phase).toBe("interrupted");
	expect(backend.calls).toEqual(["unlock", "preview", "cutover"]);
});

test("unknown cutover stays blocked until reconciliation proves it safe to retry", async () => {
	const backend = new RecoveryBackend();
	const wizard = await reviewedWizard(backend);

	const failed = await wizard.cutover();
	expect(failed.phase).toBe("interrupted");
	expect(["blocked", "failed"]).toContain(failed.status);
	expect(backend.sourceIsUsable()).toBe(true);
	const callsBeforeRetry = backend.calls.slice();

	const stillUnknown = await wizard.retry();
	expect(stillUnknown.phase).toBe("interrupted");
	expect(["blocked", "failed"]).toContain(stillUnknown.status);
	expect(stillUnknown.error?.retryable).toBe(false);
	expect(backend.calls).toEqual([...callsBeforeRetry, "reconcile"]);
	expect(backend.sourceIsUsable()).toBe(true);

	backend.reconcileStatus = "safe-to-retry";
	const safeToRetry = await wizard.retry();
	expect(safeToRetry.phase).toBe("destination");
	expect(safeToRetry.status).toBe("idle");
	expect(backend.sourceIsUsable()).toBe(true);

	backend.durablyVerified = true;
	const retried = await wizard.unlock({
		sourcePassphrase: SYNTHETIC_PASSPHRASE,
	});
	expect(retried.phase).toBe("ready");
	expect(wizard.confirmCutover(CUTOVER_CONFIRMATION).cutoverConfirmed).toBe(
		true,
	);
	const complete = await wizard.cutover();

	expect(complete.phase).toBe("complete");
	expect(complete.status).toBe("complete");
	expect(complete.result).toEqual(successfulResult);
	expect(backend.sourceIsUsable()).toBe(false);
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
	assertSanitized(complete);
});

test("backend cutover errors enter recovery without reporting success or retiring the source", async () => {
	const backend = new RecoveryBackend();
	backend.durablyVerified = true;
	backend.failCutover = true;
	const wizard = await reviewedWizard(backend);

	const failed = await wizard.cutover();

	expect(failed.phase).toBe("interrupted");
	expect(failed.error?.code).toBe("interrupted");
	expect(failed.error?.retryable).toBe(false);
	expect(failed.result).toBeUndefined();
	expect(backend.sourceIsUsable()).toBe(true);
	assertSanitized(failed);
});

test("safe precondition failure remains retryable while preserving the source", async () => {
	const backend = new RecoveryBackend();
	backend.failPrecondition = true;
	const wizard = await reviewedWizard(backend);

	const failed = await wizard.cutover();

	expect(failed.phase).toBe("error");
	expect(failed.status).toBe("failed");
	expect(failed.error?.code).toBe("backend-error");
	expect(failed.error?.retryable).toBe(true);
	expect(backend.sourceIsUsable()).toBe(true);
	assertSanitized(failed);

	backend.failPrecondition = false;
	backend.durablyVerified = true;
	const reset = await wizard.retry();
	expect(["destination", "ready"]).toContain(reset.phase);
	const unlocked =
		reset.phase === "destination"
			? await wizard.unlock({ sourcePassphrase: SYNTHETIC_PASSPHRASE })
			: reset;
	expect(unlocked.phase).toBe("ready");
	wizard.confirmCutover(CUTOVER_CONFIRMATION);
	const complete = await wizard.cutover();
	expect(complete.phase).toBe("complete");
	expect(backend.sourceIsUsable()).toBe(false);
});
