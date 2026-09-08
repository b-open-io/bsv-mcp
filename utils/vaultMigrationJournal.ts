import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { z } from "zod";
import { accountNameSchema, regularPath } from "./accounts";
import { projectRoleBindingsSchema } from "./projectRoleBindings";
import { VaultWalletError } from "./vaultWallet";

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/);
const databaseName = z
	.string()
	.regex(/^wallet(?:-(?:main|test))?\.db(?:-wal|-shm)?$/);
export const migrationJournalSchema = z
	.object({
		version: z.literal(1),
		sessionId: z.uuid(),
		projectRoot: z.string(),
		projectId: z.string(),
		vaultPath: z.string(),
		accountName: accountNameSchema,
		phase: z.enum([
			"prepared",
			"stage-verified",
			"activation-pending",
			"vault-activated",
			"bindings-committed",
			"complete",
		]),
		sourceHashes: z.record(
			z.union([z.literal("keys.bep"), z.literal("config.json"), databaseName]),
			digestSchema,
		),
		beforeVaultHash: digestSchema.nullable(),
		stagedVaultHash: digestSchema.optional(),
		beforeConfigHash: digestSchema.nullable(),
		nextProjectConfig: projectRoleBindingsSchema.optional(),
		preserved: z
			.object({
				identity: z.literal(true),
				addresses: z.boolean(),
				databases: z.array(databaseName),
				vaultEntries: z.array(z.string()),
			})
			.strict(),
	})
	.strict();
export type MigrationJournal = z.infer<typeof migrationJournalSchema>;
export interface MigrationJournalContext {
	projectRoot: string;
	projectId: string;
	vaultPath: string;
	sessionId: string;
	accountName: string;
}

/** Resolve existing ancestors before testing ownership/exclusion boundaries. */
export function canonicalMigrationPath(input: string): string {
	if (!isAbsolute(input))
		throw new VaultWalletError(
			"INVALID_PATH",
			"Migration paths must be absolute.",
		);
	let parent = resolve(input);
	const tail: string[] = [];
	while (!existsSync(parent)) {
		const next = dirname(parent);
		if (next === parent)
			throw new VaultWalletError(
				"INVALID_PATH",
				"Migration path could not be resolved.",
			);
		tail.unshift(basename(parent));
		parent = next;
	}
	return join(realpathSync(parent), ...tail);
}
export function migrationJournalPaths(vaultPath: string, sessionId: string) {
	const id = z.uuid().parse(sessionId);
	return {
		journal: join(dirname(vaultPath), `.vault-migration-${id}.json`),
		stageDirectory: join(dirname(vaultPath), `.vault-migration-${id}`),
	};
}
export async function writeMigrationJournal(
	journal: MigrationJournal,
): Promise<void> {
	const checked = migrationJournalSchema.parse(journal);
	const path = migrationJournalPaths(
		checked.vaultPath,
		checked.sessionId,
	).journal;
	regularPath(path);
	const temporary = `${path}.${randomUUID()}.tmp`;
	const handle = await open(temporary, "wx", 0o600);
	try {
		await handle.writeFile(JSON.stringify(checked));
		await handle.sync();
	} finally {
		await handle.close();
	}
	try {
		await rename(temporary, path);
		const directory = await open(dirname(path), "r");
		try {
			await directory.sync();
		} finally {
			await directory.close();
		}
	} finally {
		await rm(temporary, { force: true });
	}
}
export function readMigrationJournal(
	context: MigrationJournalContext,
): MigrationJournal | undefined {
	const path = migrationJournalPaths(
		context.vaultPath,
		context.sessionId,
	).journal;
	regularPath(path);
	if (!existsSync(path)) return undefined;
	let journal: MigrationJournal;
	try {
		journal = migrationJournalSchema.parse(
			JSON.parse(readFileSync(path, "utf8")),
		);
	} catch {
		throw new VaultWalletError(
			"MIGRATION_JOURNAL_INVALID",
			"Migration recovery metadata is invalid; preserve the encrypted files for manual recovery.",
		);
	}
	if (
		canonicalMigrationPath(journal.projectRoot) !==
			canonicalMigrationPath(context.projectRoot) ||
		journal.projectId !== context.projectId ||
		canonicalMigrationPath(journal.vaultPath) !==
			canonicalMigrationPath(context.vaultPath) ||
		journal.accountName !== context.accountName ||
		journal.sessionId !== context.sessionId
	)
		throw new VaultWalletError(
			"MIGRATION_JOURNAL_MISMATCH",
			"This recovery record belongs to a different project, account or Vault.",
		);
	return journal;
}

/** Explicit local operator action; age alone never authorizes lock removal. */
export async function releaseAbandonedMigrationLock(
	context: MigrationJournalContext,
	confirmation: "RELEASE_ABANDONED_MIGRATION_LOCK",
): Promise<void> {
	if (confirmation !== "RELEASE_ABANDONED_MIGRATION_LOCK")
		throw new VaultWalletError(
			"CONFIRMATION_REQUIRED",
			"Confirm release of the abandoned migration lock.",
		);
	if (!readMigrationJournal(context))
		throw new VaultWalletError(
			"MIGRATION_JOURNAL_MISSING",
			"A matching recovery record is required before releasing this lock.",
		);
	const path = `${context.vaultPath}.lock`;
	regularPath(path);
	const stat = lstatSync(path);
	if (process.getuid && stat.uid !== process.getuid())
		throw new VaultWalletError(
			"LOCK_OWNER_MISMATCH",
			"The migration lock belongs to a different operating-system user.",
		);
	const bytes = readFileSync(path);
	let lock: { pid: number; sessionId: string };
	try {
		lock = z
			.object({
				pid: z.number().int().positive(),
				sessionId: z.uuid(),
				at: z.number(),
			})
			.strict()
			.parse(JSON.parse(bytes.toString("utf8")));
	} catch {
		throw new VaultWalletError(
			"LOCK_OWNER_UNKNOWN",
			"The lock owner cannot be verified; preserve it for manual recovery.",
		);
	}
	if (lock.sessionId !== context.sessionId)
		throw new VaultWalletError(
			"LOCK_OWNER_MISMATCH",
			"The lock belongs to another migration.",
		);
	try {
		process.kill(lock.pid, 0);
		throw new VaultWalletError(
			"LOCK_OWNER_ALIVE",
			"The migration process is still running; stop it before recovering the lock.",
		);
	} catch (error) {
		if (
			!(
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === "ESRCH"
			)
		)
			throw error;
	}
	if (!readFileSync(path).equals(bytes))
		throw new VaultWalletError(
			"LOCK_CHANGED",
			"The lock changed while its owner was being checked.",
		);
	await rm(path);
	const directory = await open(dirname(path), "r");
	try {
		await directory.sync();
	} finally {
		await directory.close();
	}
}
