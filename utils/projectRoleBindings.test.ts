import { describe, expect, test } from "bun:test";
import { PrivateKey } from "@bsv/sdk";
import {
	assertProjectRoleSnapshotCurrent,
	changeProjectRoleBinding,
	PROJECT_KEY_ROLES,
	type ProjectKeyRole,
	type ProjectRoleBinding,
	type ProjectRoleBindings,
	parseProjectRoleBindings,
	projectRoleBindingsSchema,
	resolveHistoricalProjectRoleBinding,
	resolveProjectRoleBinding,
} from "./projectRoleBindings";

// Public fixtures only. No user Vault, account files, wallet, or network access.
const publicKey = PrivateKey.fromString("1", 10).toPublicKey().toString();
const replacementPublicKey = PrivateKey.fromString("2", 10)
	.toPublicKey()
	.toString();
const date = "2026-09-08T00:00:00Z";

function binding(role: ProjectKeyRole, id = `${role}-1`): ProjectRoleBinding {
	return {
		bindingId: id,
		role,
		accountId: `${role}-account`,
		key: {
			vaultId: "vault-1",
			entryId: "entry-1",
			expectedPublicKey: publicKey,
		},
		keyUseContract: "direct-v1",
		createdAt: date,
	};
}

function config(projectId = "project-a"): ProjectRoleBindings {
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
		bindings: PROJECT_KEY_ROLES.map((role) => binding(role)),
		retained: [],
	};
}

function selection(role: ProjectKeyRole, id: string) {
	const { role: _role, ...fields } = binding(role, id);
	return fields;
}

describe("project role configuration", () => {
	test("all four roles select accounts independently, including ONE SAT", () => {
		const first = config();
		const second = config("project-b");
		const changed = changeProjectRoleBinding(first, {
			expectedProjectId: "project-a",
			expectedRevision: 0,
			role: "one-sat",
			binding: {
				...selection("one-sat", "one-sat-2"),
				accountId: "different-assets",
			},
		});
		expect(changed.revision).toBe(1);
		expect(changed.current).toEqual({
			...first.current,
			"one-sat": "one-sat-2",
		});
		expect(
			resolveProjectRoleBinding(changed, "project-a", "one-sat").binding
				.accountId,
		).toBe("different-assets");
		expect(first).toEqual(config());
		expect(second).toEqual(config("project-b"));
		expect(changed.bindings.slice(0, 4)).toEqual(first.bindings);
		expect(changed.retained).toEqual([
			{ bindingId: "one-sat-1", uses: ["asset-recovery", "pending-actions"] },
		]);
	});

	test("same key can be explicitly selected in multiple roles", () => {
		const parsed = parseProjectRoleBindings(config());
		expect(parsed.bindings.map((item) => item.key.entryId)).toEqual([
			"entry-1",
			"entry-1",
			"entry-1",
			"entry-1",
		]);
		for (const role of PROJECT_KEY_ROLES)
			expect(
				resolveProjectRoleBinding(parsed, "project-a", role).binding.role,
			).toBe(role);
	});

	test("missing/unassigned roles and project mismatches fail without fallback", () => {
		const value = config();
		const { payments: _payments, ...incomplete } = value.current;
		expect(() =>
			parseProjectRoleBindings({ ...value, current: incomplete }),
		).toThrow();
		const cleared = changeProjectRoleBinding(value, {
			expectedProjectId: "project-a",
			expectedRevision: 0,
			role: "payments",
			binding: null,
		});
		expect(() =>
			resolveProjectRoleBinding(cleared, "project-a", "payments"),
		).toThrow("PROJECT_ROLE_UNASSIGNED");
		expect(() =>
			resolveProjectRoleBinding(value, "other-project", "payments"),
		).toThrow("PROJECT_ROLE_PROJECT_MISMATCH");
		expect(cleared.retained[0]?.uses).toEqual([
			"fund-recovery",
			"pending-actions",
		]);
	});

	test("strict selectors reject secret material, paths and unimplemented fields", () => {
		const value = config();
		for (const key of ["value", "wif", "privateKey", "mnemonic", "vaultPath"])
			expect(() =>
				parseProjectRoleBindings({ ...value, [key]: "not-a-secret" }),
			).toThrow();
		for (const field of ["wif", "roles", "label", "wallet"])
			expect(() =>
				parseProjectRoleBindings({
					...value,
					bindings: [
						{ ...value.bindings[0], [field]: "unexpected" },
						...value.bindings.slice(1),
					],
				}),
			).toThrow();
		expect(() =>
			parseProjectRoleBindings({
				...value,
				bindings: [
					{ ...value.bindings[0], accountId: "../other" },
					...value.bindings.slice(1),
				],
			}),
		).toThrow();
		expect(() =>
			parseProjectRoleBindings({
				...value,
				bindings: [
					{
						...value.bindings[0],
						key: { ...value.bindings[0]?.key, wif: "unexpected" },
					},
					...value.bindings.slice(1),
				],
			}),
		).toThrow();
	});

	test("invalid public keys and ambiguous derivation contracts are rejected", () => {
		const value = config();
		const first = binding("identity-signing");
		for (const expectedPublicKey of ["address-not-key", `02${"ff".repeat(32)}`])
			expect(() =>
				parseProjectRoleBindings({
					...value,
					bindings: [
						{ ...first, key: { ...first.key, expectedPublicKey } },
						...value.bindings.slice(1),
					],
				}),
			).toThrow();
		const derivation = {
			scheme: "brc42" as const,
			protocolID: [2, "project signing"] as [2, string],
			keyID: "identity-1",
			counterparty: "self",
		};
		const derived = {
			...first,
			keyUseContract: "brc42-leaf-v1" as const,
			key: { ...first.key, derivation },
		};
		expect(
			projectRoleBindingsSchema.safeParse({
				...value,
				bindings: [derived, ...value.bindings.slice(1)],
			}).success,
		).toBe(true);
		for (const replacement of [
			{ ...first, keyUseContract: "brc42-leaf-v1" },
			{ ...first, key: { ...first.key, derivation } },
			{
				...derived,
				key: { ...first.key, derivation: { scheme: "brc157", index: 0 } },
			},
			{
				...derived,
				key: {
					...first.key,
					derivation: {
						...derivation,
						path: "2:project signing/identity-1/self",
					},
				},
			},
			{
				...derived,
				key: {
					...first.key,
					derivation: { ...derivation, protocolID: [2, "   "] },
				},
			},
		])
			expect(() =>
				parseProjectRoleBindings({
					...value,
					bindings: [replacement, ...value.bindings.slice(1)],
				}),
			).toThrow();
	});

	test("dangling, duplicate, cross-role and cyclic references are rejected", () => {
		const value = config();
		for (const invalid of [
			{ ...value, current: { ...value.current, payments: "missing" } },
			{ ...value, current: { ...value.current, payments: "one-sat-1" } },
			{ ...value, bindings: [...value.bindings, value.bindings[0]] },
			{
				...value,
				bindings: [
					{ ...value.bindings[0], previousBindingId: "identity-signing-1" },
					...value.bindings.slice(1),
				],
			},
			{
				...value,
				bindings: [
					value.bindings[0],
					{ ...value.bindings[1], previousBindingId: "identity-signing-1" },
					...value.bindings.slice(2),
				],
			},
			{
				...value,
				retained: [{ bindingId: "missing", uses: ["fund-recovery"] }],
			},
		])
			expect(() => parseProjectRoleBindings(invalid)).toThrow();
	});
});

describe("role transitions and pinned history", () => {
	test("switching encryption retains old ciphertext key and rejects history loss", () => {
		const initial = config();
		const next = changeProjectRoleBinding(initial, {
			expectedProjectId: "project-a",
			expectedRevision: 0,
			role: "encryption",
			binding: {
				...selection("encryption", "encryption-2"),
				key: {
					vaultId: "vault-2",
					entryId: "entry-new",
					expectedPublicKey: replacementPublicKey,
				},
			},
		});
		expect(
			resolveProjectRoleBinding(next, "project-a", "encryption").binding.key
				.expectedPublicKey,
		).toBe(replacementPublicKey);
		expect(
			resolveHistoricalProjectRoleBinding(
				next,
				"project-a",
				"encryption",
				"encryption-1",
			).binding.key.expectedPublicKey,
		).toBe(publicKey);
		expect(next.retained).toEqual([
			{ bindingId: "encryption-1", uses: ["decrypt-history"] },
		]);
		expect(next.bindings.at(-1)?.previousBindingId).toBe("encryption-1");
		expect(() => parseProjectRoleBindings({ ...next, retained: [] })).toThrow(
			"Historical binding",
		);
		expect(() =>
			resolveHistoricalProjectRoleBinding(
				next,
				"project-a",
				"payments",
				"encryption-1",
			),
		).toThrow("PROJECT_ROLE_HISTORY_MISSING");
	});

	test("clearing and reassigning a role keeps its original funding history", () => {
		const cleared = changeProjectRoleBinding(config(), {
			expectedProjectId: "project-a",
			expectedRevision: 0,
			role: "payments",
			binding: null,
		});
		const reassigned = changeProjectRoleBinding(cleared, {
			expectedProjectId: "project-a",
			expectedRevision: 1,
			role: "payments",
			binding: selection("payments", "payments-2"),
		});
		expect(reassigned.retained).toEqual(cleared.retained);
		expect(
			resolveHistoricalProjectRoleBinding(
				reassigned,
				"project-a",
				"payments",
				"payments-1",
			).binding,
		).toEqual(binding("payments"));
		expect(() =>
			parseProjectRoleBindings({
				...cleared,
				retained: [{ bindingId: "payments-1", uses: ["pending-actions"] }],
			}),
		).toThrow();
	});

	test("revision conflicts reject stale transitions without changing inputs", () => {
		const original = config();
		const next = changeProjectRoleBinding(original, {
			expectedProjectId: "project-a",
			expectedRevision: 0,
			role: "identity-signing",
			binding: selection("identity-signing", "identity-signing-2"),
		});
		expect(() =>
			changeProjectRoleBinding(next, {
				expectedProjectId: "project-a",
				expectedRevision: 0,
				role: "payments",
				binding: null,
			}),
		).toThrow("PROJECT_ROLE_REVISION_CONFLICT");
		expect(() =>
			changeProjectRoleBinding(original, {
				expectedProjectId: "wrong-project",
				expectedRevision: 0,
				role: "payments",
				binding: null,
			}),
		).toThrow("PROJECT_ROLE_PROJECT_MISMATCH");
		expect(original).toEqual(config());
		expect(next.retained[0]?.uses).toEqual([
			"verify-history",
			"pending-actions",
		]);
	});

	test("binding IDs cannot be reused to overwrite historical key material", () => {
		expect(() =>
			changeProjectRoleBinding(config(), {
				expectedProjectId: "project-a",
				expectedRevision: 0,
				role: "payments",
				binding: {
					...selection("payments", "payments-1"),
					key: {
						vaultId: "other",
						entryId: "other",
						expectedPublicKey: replacementPublicKey,
					},
				},
			}),
		).toThrow("PROJECT_ROLE_BINDING_ID_EXISTS");
	});

	test("snapshots are deeply immutable and changes invalidate them", () => {
		const initial = config();
		const snapshot = resolveProjectRoleBinding(
			initial,
			"project-a",
			"payments",
		);
		expect(Object.isFrozen(snapshot.binding.key)).toBe(true);
		expect(() => {
			(snapshot.binding.key as { entryId: string }).entryId = "changed";
		}).toThrow();
		assertProjectRoleSnapshotCurrent(initial, snapshot);
		const changed = changeProjectRoleBinding(initial, {
			expectedProjectId: "project-a",
			expectedRevision: 0,
			role: "encryption",
			binding: null,
		});
		expect(() => assertProjectRoleSnapshotCurrent(changed, snapshot)).toThrow(
			"PROJECT_ROLE_SNAPSHOT_STALE",
		);
		const payments = initial.bindings[1];
		if (!payments) throw new Error("Missing fixture binding");
		payments.key.entryId = "edited-without-revision";
		expect(snapshot.binding.key.entryId).toBe("entry-1");
		expect(() => assertProjectRoleSnapshotCurrent(initial, snapshot)).toThrow(
			"PROJECT_ROLE_SNAPSHOT_STALE",
		);
	});

	test("revision overflow cannot silently overwrite a prior generation", () => {
		expect(() =>
			changeProjectRoleBinding(
				{ ...config(), revision: Number.MAX_SAFE_INTEGER },
				{
					expectedProjectId: "project-a",
					expectedRevision: Number.MAX_SAFE_INTEGER,
					role: "payments",
					binding: null,
				},
			),
		).toThrow("PROJECT_ROLE_REVISION_EXHAUSTED");
	});
});
