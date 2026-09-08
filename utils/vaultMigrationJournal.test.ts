import { afterEach, expect, it } from "bun:test";
import {
	mkdtempSync,
	mkdirSync,
	writeFileSync,
	existsSync,
	rmSync,
	symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
	canonicalMigrationPath,
	readMigrationJournal,
	writeMigrationJournal,
	releaseAbandonedMigrationLock,
	type MigrationJournal,
} from "./vaultMigrationJournal";
const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});
function fixture() {
	const root = mkdtempSync(join(tmpdir(), "migration-journal-"));
	roots.push(root);
	const journal: MigrationJournal = {
		version: 1,
		sessionId: randomUUID(),
		projectRoot: root,
		projectId: "synthetic",
		vaultPath: join(root, "vault.bep"),
		accountName: "test",
		phase: "prepared",
		sourceHashes: { "keys.bep": "a".repeat(64) },
		beforeVaultHash: null,
		beforeConfigHash: null,
		preserved: {
			identity: true,
			addresses: true,
			databases: [],
			vaultEntries: [],
		},
	};
	return { root, journal };
}
it("persists a strict public receipt and rejects mismatched recovery contexts", async () => {
	const { journal } = fixture();
	await writeMigrationJournal(journal);
	expect(readMigrationJournal(journal)).toEqual(journal);
	expect(() =>
		readMigrationJournal({ ...journal, projectId: "other" }),
	).toThrow("different project");
});
it("resolves symlink ancestors even when the destination does not exist", () => {
	const { root } = fixture();
	mkdirSync(join(root, "accounts"));
	symlinkSync(join(root, "accounts"), join(root, "alias"));
	expect(canonicalMigrationPath(join(root, "alias", "new", "vault.bep"))).toBe(
		canonicalMigrationPath(join(root, "accounts", "new", "vault.bep")),
	);
});
it("never releases a live process lock or an unmatched session", async () => {
	const { journal } = fixture();
	await writeMigrationJournal(journal);
	writeFileSync(
		`${journal.vaultPath}.lock`,
		JSON.stringify({ pid: process.pid, sessionId: journal.sessionId, at: 0 }),
	);
	await expect(
		releaseAbandonedMigrationLock(journal, "RELEASE_ABANDONED_MIGRATION_LOCK"),
	).rejects.toMatchObject({ code: "LOCK_OWNER_ALIVE" });
	expect(existsSync(`${journal.vaultPath}.lock`)).toBe(true);
	writeFileSync(
		`${journal.vaultPath}.lock`,
		JSON.stringify({ pid: process.pid, sessionId: randomUUID(), at: 0 }),
	);
	await expect(
		releaseAbandonedMigrationLock(journal, "RELEASE_ABANDONED_MIGRATION_LOCK"),
	).rejects.toMatchObject({ code: "LOCK_OWNER_MISMATCH" });
});
it("requires exact confirmation before attempting recovery", async () => {
	const { journal } = fixture();
	await writeMigrationJournal(journal);
	await expect(
		releaseAbandonedMigrationLock(journal, "wrong" as never),
	).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
});
