import { describe, expect, test } from "bun:test";
import {
	lstat,
	mkdir,
	mkdtemp,
	open,
	readdir,
	readFile,
	rename,
	rm,
	symlink,
	utimes,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	changeProjectRoleBinding,
	PROJECT_KEY_ROLES,
	type ProjectKeyRole,
	type ProjectRoleBindings,
} from "./projectRoleBindings";
import {
	loadProjectRoleBindings,
	PROJECT_ROLE_CONFIG_FILENAME,
	ProjectRoleStoreError,
	saveProjectRoleBindings,
} from "./projectRoleBindingsStore";

const publicKey =
	"0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

function initial(projectId = "project-a"): ProjectRoleBindings {
	return {
		schemaVersion: 1,
		projectId,
		revision: 0,
		current: {
			"identity-signing": "identity-signing-1",
			payments: "payments-1",
			"one-sat": "one-sat-1",
			encryption: "encryption-1",
		},
		bindings: PROJECT_KEY_ROLES.map((role) => ({
			bindingId: `${role}-1`,
			role,
			accountId: "test-account",
			key: {
				vaultId: "vault-1",
				entryId: "entry-1",
				expectedPublicKey: publicKey,
			},
			keyUseContract: "direct-v1",
			createdAt: "2026-09-08T00:00:00Z",
		})),
		retained: [],
	};
}

function changed(config: ProjectRoleBindings, role: ProjectKeyRole) {
	return changeProjectRoleBinding(config, {
		expectedProjectId: config.projectId,
		expectedRevision: config.revision,
		role,
		binding: {
			bindingId: `${role}-2`,
			accountId: "other-account",
			key: {
				vaultId: "vault-1",
				entryId: "entry-2",
				expectedPublicKey: publicKey,
			},
			keyUseContract: "direct-v1",
			createdAt: "2026-09-08T01:00:00Z",
		},
	});
}

async function fixture(run: (directory: string) => Promise<void>) {
	const directory = await mkdtemp(join(tmpdir(), "bsv-project-role-store-"));
	try {
		await run(directory);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

describe("project-scoped role persistence", () => {
	test("missing config is read-only and never discovers an ancestor/global config", async () => {
		await fixture(async (directory) => {
			const child = join(directory, "nested-project");
			await mkdir(child);
			await saveProjectRoleBindings(directory, initial(), {
				expectedProjectId: "project-a",
				expectedRevision: null,
			});
			expect(await loadProjectRoleBindings(child, "project-a")).toBeNull();
			expect(await readdir(child)).toEqual([]);
			await expect(loadProjectRoleBindings(".", "project-a")).rejects.toThrow(
				"PROJECT_ROLE_ROOT_INVALID",
			);
		});
	});

	test("initial save preserves unrelated settings and writes references with restrictive mode", async () => {
		await fixture(async (directory) => {
			const path = join(directory, PROJECT_ROLE_CONFIG_FILENAME);
			const unrelated = {
				ui: { theme: "dark" },
				futureSetting: [1, true, "keep"],
			};
			await writeFile(path, JSON.stringify(unrelated));
			const saved = await saveProjectRoleBindings(directory, initial(), {
				expectedProjectId: "project-a",
				expectedRevision: null,
			});
			const document = JSON.parse(await readFile(path, "utf8"));
			expect(document).toEqual({ ...unrelated, roleBindings: initial() });
			expect(await loadProjectRoleBindings(directory, "project-a")).toEqual(
				saved,
			);
			expect(Object.isFrozen(saved.bindings[0]?.key)).toBe(true);
			expect((await lstat(path)).mode & 0o777).toBe(0o600);
			expect(await readdir(directory)).toEqual([PROJECT_ROLE_CONFIG_FILENAME]);
		});
	});

	test("two projects remain independent and mismatched project identity cannot overwrite", async () => {
		await fixture(async (directory) => {
			const other = join(directory, "other");
			await mkdir(other);
			await saveProjectRoleBindings(directory, initial(), {
				expectedProjectId: "project-a",
				expectedRevision: null,
			});
			await saveProjectRoleBindings(other, initial("project-b"), {
				expectedProjectId: "project-b",
				expectedRevision: null,
			});
			await saveProjectRoleBindings(directory, changed(initial(), "one-sat"), {
				expectedProjectId: "project-a",
				expectedRevision: 0,
			});
			expect(
				(await loadProjectRoleBindings(directory, "project-a"))?.current[
					"one-sat"
				],
			).toBe("one-sat-2");
			expect(await loadProjectRoleBindings(other, "project-b")).toEqual(
				initial("project-b"),
			);
			await expect(
				loadProjectRoleBindings(directory, "project-b"),
			).rejects.toThrow("PROJECT_ROLE_PROJECT_MISMATCH");
			await expect(
				saveProjectRoleBindings(directory, initial("project-b"), {
					expectedProjectId: "project-b",
					expectedRevision: 1,
				}),
			).rejects.toThrow("PROJECT_ROLE_PROJECT_MISMATCH");
		});
	});

	test("concurrent saves allow one winner and stale revisions cannot silently overwrite", async () => {
		await fixture(async (directory) => {
			await saveProjectRoleBindings(directory, initial(), {
				expectedProjectId: "project-a",
				expectedRevision: null,
			});
			const outcomes = await Promise.allSettled([
				saveProjectRoleBindings(directory, changed(initial(), "payments"), {
					expectedProjectId: "project-a",
					expectedRevision: 0,
				}),
				saveProjectRoleBindings(directory, changed(initial(), "encryption"), {
					expectedProjectId: "project-a",
					expectedRevision: 0,
				}),
			]);
			expect(
				outcomes.filter((outcome) => outcome.status === "fulfilled"),
			).toHaveLength(1);
			const rejected = outcomes.find(
				(outcome) => outcome.status === "rejected",
			);
			if (rejected?.status !== "rejected")
				throw new Error("Expected conflicting writer");
			expect(rejected.reason).toBeInstanceOf(ProjectRoleStoreError);
			expect([
				"PROJECT_ROLE_CONFIG_LOCKED",
				"PROJECT_ROLE_REVISION_CONFLICT",
			]).toContain(rejected.reason.code);
			expect(
				(await loadProjectRoleBindings(directory, "project-a"))?.revision,
			).toBe(1);
			await expect(
				saveProjectRoleBindings(directory, changed(initial(), "one-sat"), {
					expectedProjectId: "project-a",
					expectedRevision: 0,
				}),
			).rejects.toThrow("PROJECT_ROLE_REVISION_CONFLICT");
			expect(await readdir(directory)).toEqual([PROJECT_ROLE_CONFIG_FILENAME]);
		});
	});

	test("aged and abandoned locks are never silently reclaimed", async () => {
		await fixture(async (directory) => {
			await saveProjectRoleBindings(directory, initial(), {
				expectedProjectId: "project-a",
				expectedRevision: null,
			});
			const lockPath = join(directory, `${PROJECT_ROLE_CONFIG_FILENAME}.lock`);
			const owner = JSON.stringify({
				pid: 999999999,
				createdAt: "2000-01-01T00:00:00Z",
			});
			await writeFile(lockPath, owner);
			await utimes(lockPath, new Date(0), new Date(0));
			await expect(
				saveProjectRoleBindings(directory, changed(initial(), "payments"), {
					expectedProjectId: "project-a",
					expectedRevision: 0,
				}),
			).rejects.toThrow("PROJECT_ROLE_CONFIG_LOCKED");
			expect(await readFile(lockPath, "utf8")).toBe(owner);
			expect(await loadProjectRoleBindings(directory, "project-a")).toEqual(
				initial(),
			);
		});
	});

	test("root, config and lock symlinks never redirect access", async () => {
		await fixture(async (directory) => {
			const actual = join(directory, "actual");
			await mkdir(actual);
			const alias = join(directory, "alias");
			await symlink(actual, alias);
			await expect(loadProjectRoleBindings(alias, "project-a")).rejects.toThrow(
				"PROJECT_ROLE_PATH_UNSAFE",
			);
			const target = join(directory, "outside.json");
			await writeFile(target, '{"untouched":true}');
			const configPath = join(actual, PROJECT_ROLE_CONFIG_FILENAME);
			await symlink(target, configPath);
			await expect(
				loadProjectRoleBindings(actual, "project-a"),
			).rejects.toThrow("PROJECT_ROLE_PATH_UNSAFE");
			await expect(
				saveProjectRoleBindings(actual, initial(), {
					expectedProjectId: "project-a",
					expectedRevision: null,
				}),
			).rejects.toThrow("PROJECT_ROLE_PATH_UNSAFE");
			await rm(configPath);
			await symlink(
				target,
				join(actual, `${PROJECT_ROLE_CONFIG_FILENAME}.lock`),
			);
			await expect(
				saveProjectRoleBindings(actual, initial(), {
					expectedProjectId: "project-a",
					expectedRevision: null,
				}),
			).rejects.toThrow("PROJECT_ROLE_PATH_UNSAFE");
			expect(await readFile(target, "utf8")).toBe('{"untouched":true}');
		});
	});

	test("invalid bindings and malformed existing settings never overwrite a file", async () => {
		await fixture(async (directory) => {
			const path = join(directory, PROJECT_ROLE_CONFIG_FILENAME);
			await writeFile(path, "{broken");
			await expect(
				saveProjectRoleBindings(directory, initial(), {
					expectedProjectId: "project-a",
					expectedRevision: null,
				}),
			).rejects.toThrow("PROJECT_ROLE_CONFIG_INVALID");
			expect(await readFile(path, "utf8")).toBe("{broken");
			await writeFile(path, '{"ui":{"keep":true}}');
			await expect(
				saveProjectRoleBindings(
					directory,
					{ ...initial(), wif: "not-a-real-secret" },
					{ expectedProjectId: "project-a", expectedRevision: null },
				),
			).rejects.toThrow();
			expect(await readFile(path, "utf8")).toBe('{"ui":{"keep":true}}');
			await expect(
				saveProjectRoleBindings(
					directory,
					{ ...initial(), revision: 8 },
					{ expectedProjectId: "project-a", expectedRevision: null },
				),
			).rejects.toThrow("PROJECT_ROLE_REVISION_CONFLICT");
			expect(await readdir(directory)).toEqual([PROJECT_ROLE_CONFIG_FILENAME]);
		});
	});

	test("saving cannot rewrite or remove historical bindings even with a valid revision", async () => {
		await fixture(async (directory) => {
			await saveProjectRoleBindings(directory, initial(), {
				expectedProjectId: "project-a",
				expectedRevision: null,
			});
			const next = changed(initial(), "payments");
			await saveProjectRoleBindings(directory, next, {
				expectedProjectId: "project-a",
				expectedRevision: 0,
			});
			const rewritten = {
				...next,
				revision: 2,
				bindings: next.bindings.map((binding) =>
					binding.bindingId === "payments-1"
						? { ...binding, accountId: "rewritten-history" }
						: binding,
				),
			};
			await expect(
				saveProjectRoleBindings(directory, rewritten, {
					expectedProjectId: "project-a",
					expectedRevision: 1,
				}),
			).rejects.toThrow("PROJECT_ROLE_HISTORY_CHANGED");
			const removed = {
				...next,
				revision: 2,
				retained: [],
				bindings: next.bindings
					.filter((binding) => binding.bindingId !== "payments-1")
					.map((binding) => {
						const { previousBindingId: _previous, ...rest } = binding;
						return rest;
					}),
			};
			await expect(
				saveProjectRoleBindings(directory, removed, {
					expectedProjectId: "project-a",
					expectedRevision: 1,
				}),
			).rejects.toThrow("PROJECT_ROLE_HISTORY_CHANGED");
			expect(await loadProjectRoleBindings(directory, "project-a")).toEqual(
				next,
			);
		});
	});

	test("retention cannot be downgraded and old IDs cannot be reselected", async () => {
		await fixture(async (directory) => {
			const value = initial();
			value.retained = [
				{ bindingId: "identity-signing-1", uses: ["verify-history"] },
			];
			await saveProjectRoleBindings(directory, value, {
				expectedProjectId: "project-a",
				expectedRevision: null,
			});
			await expect(
				saveProjectRoleBindings(
					directory,
					{ ...value, revision: 1, retained: [] },
					{ expectedProjectId: "project-a", expectedRevision: 0 },
				),
			).rejects.toThrow("PROJECT_ROLE_HISTORY_CHANGED");
			const next = changed(value, "payments");
			await saveProjectRoleBindings(directory, next, {
				expectedProjectId: "project-a",
				expectedRevision: 0,
			});
			await expect(
				saveProjectRoleBindings(
					directory,
					{
						...next,
						revision: 2,
						current: { ...next.current, payments: "payments-1" },
						retained: [
							...next.retained,
							{
								bindingId: "payments-2",
								uses: ["fund-recovery", "pending-actions"],
							},
						],
					},
					{ expectedProjectId: "project-a", expectedRevision: 1 },
				),
			).rejects.toThrow("PROJECT_ROLE_HISTORY_CHANGED");
		});
	});

	test("a replaced lock aborts the commit and leaves the replacement for reconciliation", async () => {
		await fixture(async (directory) => {
			await saveProjectRoleBindings(directory, initial(), {
				expectedProjectId: "project-a",
				expectedRevision: null,
			});
			const lockPath = join(directory, `${PROJECT_ROLE_CONFIG_FILENAME}.lock`);
			const probePath = join(directory, "prototype-probe");
			const probe = await open(probePath, "w");
			const fileHandlePrototype = Object.getPrototypeOf(probe) as {
				writeFile: (...args: unknown[]) => Promise<unknown>;
			};
			await probe.close();
			await rm(probePath);

			const originalWriteFile = fileHandlePrototype.writeFile;
			let releaseWrite!: () => void;
			const writeRelease = new Promise<void>((resolve) => {
				releaseWrite = resolve;
			});
			let lockWriteStarted!: () => void;
			const lockWriteReady = new Promise<void>((resolve) => {
				lockWriteStarted = resolve;
			});
			let blocked = false;
			fileHandlePrototype.writeFile = async function (
				this: unknown,
				...args: unknown[]
			) {
				if (
					!blocked &&
					typeof args[0] === "string" &&
					args[0].includes('"pid"')
				) {
					blocked = true;
					lockWriteStarted();
					await writeRelease;
				}
				return originalWriteFile.apply(this, args);
			};

			try {
				const saving = saveProjectRoleBindings(
					directory,
					changed(initial(), "payments"),
					{ expectedProjectId: "project-a", expectedRevision: 0 },
				);
				await lockWriteReady;
				const replacementPath = join(directory, "operator-lock");
				await writeFile(replacementPath, "operator reconciliation");
				await rename(replacementPath, lockPath);
				releaseWrite();
				await expect(saving).rejects.toThrow("PROJECT_ROLE_LOCK_LOST");
				expect(await readFile(lockPath, "utf8")).toBe(
					"operator reconciliation",
				);
				expect(await loadProjectRoleBindings(directory, "project-a")).toEqual(
					initial(),
				);
			} finally {
				releaseWrite();
				fileHandlePrototype.writeFile = originalWriteFile;
			}
		});
	});

	test("readers see complete JSON during replacement; identical saves do not rewrite", async () => {
		await fixture(async (directory) => {
			await saveProjectRoleBindings(directory, initial(), {
				expectedProjectId: "project-a",
				expectedRevision: null,
			});
			const path = join(directory, PROJECT_ROLE_CONFIG_FILENAME);
			const next = changed(initial(), "encryption");
			const writing = saveProjectRoleBindings(directory, next, {
				expectedProjectId: "project-a",
				expectedRevision: 0,
			});
			for (let i = 0; i < 12; i++) {
				const document = JSON.parse(await readFile(path, "utf8"));
				expect([0, 1]).toContain(document.roleBindings.revision);
			}
			await writing;
			const before = await lstat(path);
			await saveProjectRoleBindings(directory, next, {
				expectedProjectId: "project-a",
				expectedRevision: 1,
			});
			expect((await lstat(path)).ino).toBe(before.ino);
			expect(await readdir(directory)).toEqual([PROJECT_ROLE_CONFIG_FILENAME]);
		});
	});
});
