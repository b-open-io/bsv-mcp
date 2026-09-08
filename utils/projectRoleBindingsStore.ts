import { randomUUID } from "node:crypto";
import { constants, type Stats } from "node:fs";
import {
	type FileHandle,
	lstat,
	open,
	realpath,
	rename,
	unlink,
} from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import {
	PROJECT_KEY_ROLES,
	type ProjectRoleBindings,
	parseProjectRoleBindings,
} from "./projectRoleBindings";

export const PROJECT_ROLE_CONFIG_FILENAME = ".bsv-mcp.json";
const MAX_CONFIG_BYTES = 1024 * 1024;

export class ProjectRoleStoreError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(`${code}: ${message}`);
		this.name = "ProjectRoleStoreError";
	}
}

function fail(code: string, message: string): never {
	throw new ProjectRoleStoreError(code, message);
}

function isErrno(error: unknown, code: string): boolean {
	return error instanceof Error && "code" in error && error.code === code;
}

function sameFile(a: Stats, b: Stats): boolean {
	return a.dev === b.dev && a.ino === b.ino;
}

/**
 * Callers choose a trusted absolute project root, never request data or cwd.
 * A symlink as the root itself is rejected; parent aliases (e.g. /tmp on macOS)
 * are canonicalized once so all cooperating writers use the same lock.
 */
async function projectLocation(projectRoot: string) {
	if (!isAbsolute(projectRoot))
		fail(
			"PROJECT_ROLE_ROOT_INVALID",
			"An explicit absolute project root is required",
		);
	const requested = await lstat(projectRoot);
	if (!requested.isDirectory() || requested.isSymbolicLink())
		fail("PROJECT_ROLE_PATH_UNSAFE", "Project root must be a real directory");
	const root = await realpath(projectRoot);
	const identity = await lstat(root);
	return {
		root,
		identity,
		configPath: join(root, PROJECT_ROLE_CONFIG_FILENAME),
		lockPath: join(root, `${PROJECT_ROLE_CONFIG_FILENAME}.lock`),
	};
}

type Location = Awaited<ReturnType<typeof projectLocation>>;

async function assertRoot(location: Location) {
	const current = await lstat(location.root);
	if (
		!current.isDirectory() ||
		current.isSymbolicLink() ||
		!sameFile(current, location.identity)
	)
		fail("PROJECT_ROLE_PATH_UNSAFE", "Project directory changed during access");
}

async function readDocument(location: Location): Promise<{
	raw: string | null;
	document: Record<string, unknown>;
}> {
	await assertRoot(location);
	let file: FileHandle;
	try {
		file = await open(
			location.configPath,
			constants.O_RDONLY | constants.O_NOFOLLOW,
		);
	} catch (error) {
		if (isErrno(error, "ENOENT")) return { raw: null, document: {} };
		if (isErrno(error, "ELOOP"))
			fail("PROJECT_ROLE_PATH_UNSAFE", "Project config must not be a symlink");
		throw error;
	}
	try {
		const info = await file.stat();
		if (!info.isFile())
			fail("PROJECT_ROLE_PATH_UNSAFE", "Project config must be a regular file");
		if (info.size > MAX_CONFIG_BYTES)
			fail(
				"PROJECT_ROLE_CONFIG_INVALID",
				"Project config exceeds the size limit",
			);
		const raw = await file.readFile("utf8");
		if (Buffer.byteLength(raw, "utf8") > MAX_CONFIG_BYTES)
			fail(
				"PROJECT_ROLE_CONFIG_INVALID",
				"Project config exceeds the size limit",
			);
		let document: unknown;
		try {
			document = JSON.parse(raw);
		} catch {
			fail(
				"PROJECT_ROLE_CONFIG_INVALID",
				"Project config must contain valid JSON",
			);
		}
		if (
			document === null ||
			typeof document !== "object" ||
			Array.isArray(document)
		)
			fail(
				"PROJECT_ROLE_CONFIG_INVALID",
				"Project config must be a JSON object",
			);
		return { raw, document: document as Record<string, unknown> };
	} finally {
		await file.close();
	}
}

function scopedBindings(input: unknown, expectedProjectId: string) {
	const config = parseProjectRoleBindings(input);
	if (config.projectId !== expectedProjectId)
		fail(
			"PROJECT_ROLE_PROJECT_MISMATCH",
			"Config belongs to a different project",
		);
	return config;
}

/** No ancestor search, account fallback, directory creation, or Vault access. */
export async function loadProjectRoleBindings(
	projectRoot: string,
	expectedProjectId: string,
) {
	const location = await projectLocation(projectRoot);
	const { document } = await readDocument(location);
	if (!Object.hasOwn(document, "roleBindings")) return null;
	return scopedBindings(document.roleBindings, expectedProjectId);
}

function assertHistoryPreserved(
	previous: ReturnType<typeof parseProjectRoleBindings>,
	next: ReturnType<typeof parseProjectRoleBindings>,
) {
	if (
		next.bindings.length < previous.bindings.length ||
		previous.bindings.some(
			(binding, index) =>
				JSON.stringify(binding) !== JSON.stringify(next.bindings[index]),
		)
	)
		fail(
			"PROJECT_ROLE_HISTORY_CHANGED",
			"Existing bindings are immutable and cannot be removed",
		);
	for (const retained of previous.retained) {
		const updated = next.retained.find(
			(item) => item.bindingId === retained.bindingId,
		);
		if (!updated || retained.uses.some((use) => !updated.uses.includes(use)))
			fail(
				"PROJECT_ROLE_HISTORY_CHANGED",
				"Historical recovery uses cannot be removed",
			);
	}
	const oldIds = new Set(previous.bindings.map((item) => item.bindingId));
	for (const role of PROJECT_KEY_ROLES) {
		const nextId = next.current[role];
		if (
			nextId !== null &&
			nextId !== previous.current[role] &&
			oldIds.has(nextId)
		)
			fail(
				"PROJECT_ROLE_HISTORY_CHANGED",
				"Reselection requires a new binding ID",
			);
	}
	for (const binding of next.bindings.slice(previous.bindings.length)) {
		if (
			next.current[binding.role] !== binding.bindingId ||
			(binding.previousBindingId ?? null) !== previous.current[binding.role]
		)
			fail(
				"PROJECT_ROLE_HISTORY_CHANGED",
				"New bindings must select a role and retain its predecessor",
			);
	}
}

export interface SaveProjectRoleBindingsOptions {
	expectedProjectId: string;
	/** null creates the roleBindings section only if it is absent. */
	expectedRevision: number | null;
}

/**
 * Replace only the roleBindings section. Existing unrelated JSON fields survive;
 * callers cannot supply new unrelated fields or secret material via this API.
 *
 * A per-project exclusive lock covers read/check/rename. Locks are never stolen
 * based on age or PID: an abandoned lock needs explicit operator reconciliation.
 * Readers observe the old or complete new file. Data is fsynced before rename;
 * no cross-filesystem or multi-file transaction is claimed. Noncooperating local
 * writers must not edit this file concurrently; a second read detects changes
 * before rename but cannot lock arbitrary editors. On an I/O error, reload before
 * retrying because replacement may already have completed.
 */
export async function saveProjectRoleBindings(
	projectRoot: string,
	input: unknown,
	options: SaveProjectRoleBindingsOptions,
) {
	const next = scopedBindings(input, options.expectedProjectId);
	const location = await projectLocation(projectRoot);
	let lock: FileHandle;
	try {
		lock = await open(
			location.lockPath,
			constants.O_WRONLY |
				constants.O_CREAT |
				constants.O_EXCL |
				constants.O_NOFOLLOW,
			0o600,
		);
	} catch (error) {
		if (isErrno(error, "EEXIST") || isErrno(error, "ELOOP")) {
			const existing = await lstat(location.lockPath);
			if (!existing.isFile() || existing.isSymbolicLink())
				fail("PROJECT_ROLE_PATH_UNSAFE", "Project lock must be a regular file");
			fail(
				"PROJECT_ROLE_CONFIG_LOCKED",
				"Another save or abandoned lock requires reconciliation",
			);
		}
		throw error;
	}
	const lockIdentity = await lock.stat();
	const assertLock = async () => {
		const current = await lstat(location.lockPath);
		if (!current.isFile() || !sameFile(current, lockIdentity))
			fail("PROJECT_ROLE_LOCK_LOST", "Project lock changed during save");
	};
	let temporaryPath: string | undefined;
	try {
		await lock.writeFile(
			JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
		);
		const before = await readDocument(location);
		const previous = Object.hasOwn(before.document, "roleBindings")
			? scopedBindings(before.document.roleBindings, options.expectedProjectId)
			: null;
		if ((previous?.revision ?? null) !== options.expectedRevision)
			fail(
				"PROJECT_ROLE_REVISION_CONFLICT",
				"Project config changed; reload before saving",
			);
		if (previous === null) {
			if (next.revision !== 0)
				fail(
					"PROJECT_ROLE_REVISION_CONFLICT",
					"Initial project revision must be zero",
				);
		} else {
			if (JSON.stringify(previous) === JSON.stringify(next)) return next;
			if (
				previous.revision === Number.MAX_SAFE_INTEGER ||
				next.revision !== previous.revision + 1
			)
				fail(
					"PROJECT_ROLE_REVISION_CONFLICT",
					"Next revision must increment the current revision once",
				);
			assertHistoryPreserved(previous, next);
		}
		const serialized = `${JSON.stringify({ ...before.document, roleBindings: next }, null, 2)}\n`;
		if (Buffer.byteLength(serialized, "utf8") > MAX_CONFIG_BYTES)
			fail(
				"PROJECT_ROLE_CONFIG_INVALID",
				"Project config exceeds the size limit",
			);
		temporaryPath = join(
			location.root,
			`${PROJECT_ROLE_CONFIG_FILENAME}.${randomUUID()}.tmp`,
		);
		const temporary = await open(temporaryPath, "wx", 0o600);
		try {
			await temporary.writeFile(serialized, "utf8");
			await temporary.sync();
		} finally {
			await temporary.close();
		}
		await assertRoot(location);
		await assertLock();
		const latest = await readDocument(location);
		if (latest.raw !== before.raw)
			fail(
				"PROJECT_ROLE_REVISION_CONFLICT",
				"Project settings changed during save",
			);
		await rename(temporaryPath, location.configPath);
		temporaryPath = undefined;
		return next;
	} finally {
		try {
			if (temporaryPath !== undefined) await unlink(temporaryPath);
		} finally {
			await lock.close();
			await assertLock();
			await unlink(location.lockPath);
		}
	}
}

// Keep the persisted shape exported alongside the storage entry points.
export type { ProjectRoleBindings };
