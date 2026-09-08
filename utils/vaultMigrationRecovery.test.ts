import { afterEach, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { open, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * This is the execution contract the future local migration wizard must obey.
 * It deliberately has no password, key, or plaintext payload argument.
 * Unlocking happens behind the adapter boundary, and only encrypted bytes may
 * cross into the destination staging area.
 */
interface UnlockedSource {
	readonly encryptedEntry: Uint8Array;
}

interface MigrationAdapter {
	unlockSource(sourcePath: string): Promise<UnlockedSource>;
	stageEncryptedDestination(
		stagingPath: string,
		unlocked: UnlockedSource,
	): Promise<void>;
	verifyDurableEncryptedDestination(stagingPath: string): Promise<boolean>;
	activateDestination(
		stagingPath: string,
		destinationPath: string,
	): Promise<void>;
	retireSource(sourcePath: string): Promise<void>;
}

type CancellationPoint =
	| "before-unlock"
	| "after-unlock"
	| "after-stage"
	| "after-verify";
type FailureReason =
	| "cancelled"
	| "unlock-failed"
	| "destination-write-failed"
	| "destination-unverified"
	| "cutover-failed";

interface MigrationResult {
	readonly status: "succeeded" | "cancelled" | "failed";
	readonly reason?: FailureReason;
}

class MigrationCancelled extends Error {}

const SYNTHETIC_SOURCE_BYTES = Uint8Array.from([
	0x56, 0x42, 0x45, 0x50, 0x01, 0x7a, 0x11, 0xa4, 0x90, 0x2d, 0xc8, 0x6e,
]);
const SYNTHETIC_ENTRY_BYTES = Uint8Array.from([
	0x56, 0x42, 0x45, 0x50, 0x01, 0x43, 0x9f, 0x2b, 0x71, 0x0d, 0xbe, 0x38,
]);
const EXISTING_ENTRY_BYTES = Uint8Array.from([
	0x56, 0x42, 0x45, 0x50, 0x01, 0x0a, 0xe2, 0x44, 0x6c, 0x19,
]);
const PLAINTEXT_MARKER = "synthetic-plaintext-must-never-persist";

const homes: string[] = [];

function fixture() {
	const home = mkdtempSync(join(tmpdir(), "bsv-vault-recovery-"));
	homes.push(home);
	return {
		home,
		sourcePath: join(home, "legacy", "keys.bep"),
		destinationPath: join(home, "vault"),
	};
}

function bytes(path: string): Uint8Array {
	return readFileSync(path);
}

function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
	if (needle.length > haystack.length) return false;
	for (let offset = 0; offset <= haystack.length - needle.length; offset++) {
		let matched = true;
		for (let index = 0; index < needle.length; index++) {
			if (haystack[offset + index] !== needle[index]) {
				matched = false;
				break;
			}
		}
		if (matched) return true;
	}
	return false;
}

async function durableWrite(path: string, data: Uint8Array): Promise<void> {
	const handle = await open(path, "w");
	try {
		await handle.write(data);
		await handle.sync();
	} finally {
		await handle.close();
	}
}

async function runMigration(options: {
	sourcePath: string;
	destinationPath: string;
	adapter: MigrationAdapter;
	cancelAt?: CancellationPoint;
}): Promise<MigrationResult> {
	const stagingPath = `${options.destinationPath}.staging`;
	let activated = false;
	const cancelled = (point: CancellationPoint) => options.cancelAt === point;
	let phase: FailureReason = "unlock-failed";
	const checkCancellation = (point: CancellationPoint) => {
		if (cancelled(point)) throw new MigrationCancelled();
	};
	try {
		checkCancellation("before-unlock");
		const unlocked = await options.adapter.unlockSource(options.sourcePath);
		checkCancellation("after-unlock");

		phase = "destination-write-failed";
		await options.adapter.stageEncryptedDestination(stagingPath, unlocked);
		checkCancellation("after-stage");

		phase = "destination-unverified";
		if (
			!(await options.adapter.verifyDurableEncryptedDestination(stagingPath))
		) {
			return { status: "failed", reason: "destination-unverified" };
		}
		checkCancellation("after-verify");

		phase = "cutover-failed";
		await options.adapter.activateDestination(
			stagingPath,
			options.destinationPath,
		);
		activated = true;
		await options.adapter.retireSource(options.sourcePath);
		return { status: "succeeded" };
	} catch (error) {
		// Error text is intentionally discarded. An adapter must never put key or
		// unlock details in a wizard result, log line, or chat response.
		if (error instanceof MigrationCancelled) {
			return { status: "cancelled", reason: "cancelled" };
		}
		return { status: "failed", reason: phase };
	} finally {
		if (!activated) rmSync(stagingPath, { force: true, recursive: true });
	}
}

class UnlockError extends Error {}
class StageWriteError extends Error {}
class CutoverError extends Error {}

class SyntheticAdapter implements MigrationAdapter {
	readonly calls: string[] = [];
	readonly durableStagingPaths = new Set<string>();
	failUnlock = false;
	failStage = false;
	failActivation = false;
	verifyResult = true;

	async unlockSource(sourcePath: string): Promise<UnlockedSource> {
		this.calls.push("unlock");
		// Reading the encrypted container is allowed; the opaque result never
		// exposes a password or a root key to the orchestration layer.
		if (!statSync(sourcePath).isFile())
			throw new UnlockError("source unavailable");
		if (this.failUnlock) throw new UnlockError(PLAINTEXT_MARKER);
		return { encryptedEntry: SYNTHETIC_ENTRY_BYTES };
	}

	async stageEncryptedDestination(
		stagingPath: string,
		unlocked: UnlockedSource,
	): Promise<void> {
		this.calls.push("stage");
		mkdirSync(stagingPath, { recursive: true });
		await durableWrite(
			join(stagingPath, "migrated-entry.bep"),
			unlocked.encryptedEntry,
		);
		this.durableStagingPaths.add(stagingPath);
		if (this.failStage) throw new StageWriteError(PLAINTEXT_MARKER);
	}

	async verifyDurableEncryptedDestination(
		stagingPath: string,
	): Promise<boolean> {
		this.calls.push("verify");
		if (!this.durableStagingPaths.has(stagingPath)) return false;
		const staged = bytes(join(stagingPath, "migrated-entry.bep"));
		return (
			this.verifyResult &&
			containsBytes(staged, Uint8Array.from([0x56, 0x42, 0x45, 0x50]))
		);
	}

	async activateDestination(
		stagingPath: string,
		destinationPath: string,
	): Promise<void> {
		this.calls.push("activate");
		if (this.failActivation) throw new CutoverError(PLAINTEXT_MARKER);
		mkdirSync(destinationPath, { recursive: true });
		const destinationEntry = join(destinationPath, "migrated-entry.bep");
		if (statSync(destinationEntry, { throwIfNoEntry: false })) {
			throw new CutoverError("destination entry already exists");
		}
		// Rename is the synthetic atomic activation boundary. The source is still
		// present until the separate retireSource call succeeds.
		await rename(join(stagingPath, "migrated-entry.bep"), destinationEntry);
		rmSync(stagingPath, { force: true, recursive: true });
	}

	async retireSource(sourcePath: string): Promise<void> {
		this.calls.push("retire");
		rmSync(sourcePath, { force: true });
	}
}

function createSourceAndDestination() {
	const paths = fixture();
	mkdirSync(join(paths.home, "legacy"), { recursive: true });
	mkdirSync(paths.destinationPath, { recursive: true });
	writeFileSync(paths.sourcePath, SYNTHETIC_SOURCE_BYTES);
	writeFileSync(
		join(paths.destinationPath, "existing-entry.bep"),
		EXISTING_ENTRY_BYTES,
	);
	return paths;
}

function assertNoPlaintextResultOrArtifact(
	result: MigrationResult,
	paths: { home: string },
) {
	expect(JSON.stringify(result)).not.toContain(PLAINTEXT_MARKER);
	const plaintextBytes = new TextEncoder().encode(PLAINTEXT_MARKER);
	const files = [
		join(paths.home, "legacy", "keys.bep"),
		join(paths.home, "vault", "existing-entry.bep"),
		join(paths.home, "vault", "migrated-entry.bep"),
		join(paths.home, "vault.staging", "migrated-entry.bep"),
	];
	for (const path of files) {
		const stat = statSync(path, { throwIfNoEntry: false });
		if (stat?.isFile())
			expect(containsBytes(bytes(path), plaintextBytes)).toBe(false);
	}
}

afterEach(() => {
	for (const home of homes.splice(0))
		rmSync(home, { recursive: true, force: true });
});

for (const cancelAt of [
	"before-unlock",
	"after-unlock",
	"after-stage",
	"after-verify",
] as const) {
	test(`cancellation at ${cancelAt} keeps the encrypted source usable`, async () => {
		const paths = createSourceAndDestination();
		const adapter = new SyntheticAdapter();
		const sourceBefore = bytes(paths.sourcePath);
		const existingBefore = bytes(
			join(paths.destinationPath, "existing-entry.bep"),
		);

		const result = await runMigration({ ...paths, adapter, cancelAt });

		expect(result).toEqual({ status: "cancelled", reason: "cancelled" });
		expect(adapter.calls).not.toContain("activate");
		expect(adapter.calls).not.toContain("retire");
		expect(bytes(paths.sourcePath)).toEqual(sourceBefore);
		expect(bytes(join(paths.destinationPath, "existing-entry.bep"))).toEqual(
			existingBefore,
		);
		expect(
			statSync(`${paths.destinationPath}.staging`, { throwIfNoEntry: false }),
		).toBeUndefined();
		assertNoPlaintextResultOrArtifact(result, paths);
	});
}

test("unlock failure leaves the old encrypted source unchanged and returns a sanitized error", async () => {
	const paths = createSourceAndDestination();
	const adapter = new SyntheticAdapter();
	adapter.failUnlock = true;
	const sourceBefore = bytes(paths.sourcePath);

	const result = await runMigration({ ...paths, adapter });

	expect(result).toEqual({ status: "failed", reason: "unlock-failed" });
	expect(adapter.calls).toEqual(["unlock"]);
	expect(bytes(paths.sourcePath)).toEqual(sourceBefore);
	expect(
		statSync(`${paths.destinationPath}.staging`, { throwIfNoEntry: false }),
	).toBeUndefined();
	assertNoPlaintextResultOrArtifact(result, paths);
});

test("destination write failure cleans partial output before cutover", async () => {
	const paths = createSourceAndDestination();
	const adapter = new SyntheticAdapter();
	adapter.failStage = true;
	const sourceBefore = bytes(paths.sourcePath);
	const existingBefore = bytes(
		join(paths.destinationPath, "existing-entry.bep"),
	);

	const result = await runMigration({ ...paths, adapter });

	expect(result).toEqual({
		status: "failed",
		reason: "destination-write-failed",
	});
	expect(adapter.calls).toEqual(["unlock", "stage"]);
	expect(bytes(paths.sourcePath)).toEqual(sourceBefore);
	expect(bytes(join(paths.destinationPath, "existing-entry.bep"))).toEqual(
		existingBefore,
	);
	expect(
		statSync(`${paths.destinationPath}.staging`, { throwIfNoEntry: false }),
	).toBeUndefined();
	assertNoPlaintextResultOrArtifact(result, paths);
});

test("unverified destination blocks activation and source retirement", async () => {
	const paths = createSourceAndDestination();
	const adapter = new SyntheticAdapter();
	adapter.verifyResult = false;
	const sourceBefore = bytes(paths.sourcePath);
	const existingBefore = bytes(
		join(paths.destinationPath, "existing-entry.bep"),
	);

	const result = await runMigration({ ...paths, adapter });

	expect(result).toEqual({
		status: "failed",
		reason: "destination-unverified",
	});
	expect(adapter.calls).toEqual(["unlock", "stage", "verify"]);
	expect(bytes(paths.sourcePath)).toEqual(sourceBefore);
	expect(bytes(join(paths.destinationPath, "existing-entry.bep"))).toEqual(
		existingBefore,
	);
	expect(
		statSync(`${paths.destinationPath}.staging`, { throwIfNoEntry: false }),
	).toBeUndefined();
	assertNoPlaintextResultOrArtifact(result, paths);
});

test("retry can succeed after verification failure and retires the source last", async () => {
	const paths = createSourceAndDestination();
	const firstAdapter = new SyntheticAdapter();
	firstAdapter.verifyResult = false;
	const sourceBefore = bytes(paths.sourcePath);

	const firstResult = await runMigration({ ...paths, adapter: firstAdapter });
	expect(firstResult).toEqual({
		status: "failed",
		reason: "destination-unverified",
	});
	expect(bytes(paths.sourcePath)).toEqual(sourceBefore);

	const retryAdapter = new SyntheticAdapter();
	const retryResult = await runMigration({ ...paths, adapter: retryAdapter });

	expect(retryResult).toEqual({ status: "succeeded" });
	expect(retryAdapter.calls).toEqual([
		"unlock",
		"stage",
		"verify",
		"activate",
		"retire",
	]);
	expect(statSync(paths.sourcePath, { throwIfNoEntry: false })).toBeUndefined();
	expect(bytes(join(paths.destinationPath, "existing-entry.bep"))).toEqual(
		EXISTING_ENTRY_BYTES,
	);
	expect(bytes(join(paths.destinationPath, "migrated-entry.bep"))).toEqual(
		SYNTHETIC_ENTRY_BYTES,
	);
	assertNoPlaintextResultOrArtifact(retryResult, paths);
});

test("activation failure leaves both source and existing destination entries usable", async () => {
	const paths = createSourceAndDestination();
	const adapter = new SyntheticAdapter();
	adapter.failActivation = true;
	const sourceBefore = bytes(paths.sourcePath);
	const existingBefore = bytes(
		join(paths.destinationPath, "existing-entry.bep"),
	);

	const result = await runMigration({ ...paths, adapter });

	expect(result).toEqual({ status: "failed", reason: "cutover-failed" });
	expect(adapter.calls).toEqual(["unlock", "stage", "verify", "activate"]);
	expect(bytes(paths.sourcePath)).toEqual(sourceBefore);
	expect(bytes(join(paths.destinationPath, "existing-entry.bep"))).toEqual(
		existingBefore,
	);
	expect(
		statSync(join(paths.destinationPath, "migrated-entry.bep"), {
			throwIfNoEntry: false,
		}),
	).toBeUndefined();
	expect(
		statSync(`${paths.destinationPath}.staging`, { throwIfNoEntry: false }),
	).toBeUndefined();
	assertNoPlaintextResultOrArtifact(result, paths);
});
