import { describe, expect, test } from "bun:test";
import { PrivateKey } from "@bsv/sdk";
import { PROJECT_KEY_ROLES } from "./projectRoleBindings";
import {
	type ProjectRoleCandidate,
	prepareProjectRoleSelection,
	projectRoleSelectionRequestSchema,
	renderProjectRoleSelection,
} from "./projectRoleSelection";

const empty = {
	schemaVersion: 1,
	projectId: "project-a",
	revision: 0,
	current: {
		"identity-signing": null,
		payments: null,
		"one-sat": null,
		encryption: null,
	},
	bindings: [],
	retained: [],
};
const publicKey = PrivateKey.fromString("1", 10).toPublicKey().toString();
const candidate: ProjectRoleCandidate = {
	candidateId: "key-a",
	label: "Public key",
	accountId: "account-a",
	key: { vaultId: "vault-a", entryId: "entry-a", expectedPublicKey: publicKey },
	keyUseContract: "direct-v1",
	supportedRoles: PROJECT_KEY_ROLES,
};
const request = {
	expectedProjectId: "project-a",
	expectedRevision: 0,
	roleAssignments: {
		"identity-signing": "select:key-a",
		payments: "select:key-a",
		"one-sat": "unassigned",
		encryption: "unassigned",
	},
};
const metadata = {
	createBindingId: (role: string) => `${role}-binding`,
	now: "2026-09-08T12:00:00Z",
};

describe("public project role selector", () => {
	test("initial selection uses revision zero and requires a trusted project", () => {
		const initialRequest = { ...request, expectedRevision: null };
		const result = prepareProjectRoleSelection(
			null,
			[candidate],
			initialRequest,
			{ ...metadata, expectedProjectId: "project-a" },
		);
		expect(result.revision).toBe(0);
		expect(result.bindings).toHaveLength(2);
		expect(() =>
			prepareProjectRoleSelection(null, [candidate], initialRequest, metadata),
		).toThrow("PROJECT_ROLE_PROJECT_MISMATCH");
		expect(() =>
			prepareProjectRoleSelection(null, [candidate], request, {
				...metadata,
				expectedProjectId: "project-a",
			}),
		).toThrow("PROJECT_ROLE_REVISION_CONFLICT");
		expect(
			renderProjectRoleSelection(null, [candidate], {
				expectedProjectId: "project-a",
			}),
		).toContain('name="expectedRevision" value="null"');
	});
	test("requires all four explicit choices and rejects browser-supplied key material", () => {
		expect(projectRoleSelectionRequestSchema.safeParse(request).success).toBe(
			true,
		);
		const { encryption: _, ...missing } = request.roleAssignments;
		expect(
			projectRoleSelectionRequestSchema.safeParse({
				...request,
				roleAssignments: missing,
			}).success,
		).toBe(false);
		expect(
			projectRoleSelectionRequestSchema.safeParse({
				...request,
				privateKey: "secret",
			}).success,
		).toBe(false);
		expect(
			projectRoleSelectionRequestSchema.safeParse({
				...request,
				roleAssignments: {
					...request.roleAssignments,
					payments: { entryId: "forged" },
				},
			}).success,
		).toBe(false);
	});
	test("trusted inventory creates one batch revision with explicit unassigned roles", () => {
		const result = prepareProjectRoleSelection(
			empty,
			[candidate],
			request,
			metadata,
		);
		expect(result.revision).toBe(1);
		expect(result.bindings).toHaveLength(2);
		expect(result.current["one-sat"]).toBeNull();
		expect(result.bindings[0]?.key.expectedPublicKey).toBe(publicKey);
		expect(empty.bindings).toHaveLength(0);
	});
	test("pins project, revision and current keep selection", () => {
		for (const patch of [
			{ expectedProjectId: "wrong" },
			{ expectedRevision: 1 },
			{
				roleAssignments: {
					...request.roleAssignments,
					payments: "keep:absent",
				},
			},
		]) {
			expect(() =>
				prepareProjectRoleSelection(
					empty,
					[candidate],
					{ ...request, ...patch },
					metadata,
				),
			).toThrow();
		}
	});
	test("forged disabled or missing candidates fail before binding creation", () => {
		for (const inventory of [
			[],
			[{ ...candidate, supportedRoles: [] }],
			[{ ...candidate, unavailableReason: "Locked" }],
			[{ ...candidate, keyUseContract: "brc42-leaf-v1" as const }],
			[{ ...candidate, accountId: undefined }],
		]) {
			expect(() =>
				prepareProjectRoleSelection(empty, inventory, request, metadata),
			).toThrow("PROJECT_ROLE_CANDIDATE_UNAVAILABLE");
		}
		expect(() =>
			prepareProjectRoleSelection(
				empty,
				[candidate, candidate],
				request,
				metadata,
			),
		).toThrow("PROJECT_ROLE_INVALID_CANDIDATE_ID");
	});
	test("keeping is a no-op and clearing preserves historical references", () => {
		const first = prepareProjectRoleSelection(
			empty,
			[candidate],
			request,
			metadata,
		);
		const keepRequest = {
			...request,
			expectedRevision: 1,
			roleAssignments: {
				...request.roleAssignments,
				"identity-signing": "keep:identity-signing-binding",
				payments: "keep:payments-binding",
			},
		};
		expect(
			prepareProjectRoleSelection(first, [], keepRequest, metadata),
		).toEqual(first);
		const cleared = prepareProjectRoleSelection(
			first,
			[],
			{
				...keepRequest,
				roleAssignments: {
					...keepRequest.roleAssignments,
					payments: "unassigned",
				},
			},
			metadata,
		);
		expect(cleared.revision).toBe(2);
		expect(cleared.retained).toEqual([
			{
				bindingId: "payments-binding",
				uses: ["fund-recovery", "pending-actions"],
			},
		]);
		const html = renderProjectRoleSelection(cleared, []);
		expect(html).toContain("fund-recovery");
		expect(html).toContain(publicKey);
	});
	test("renders all roles, escapes untrusted labels and disables unsupported profiles", () => {
		const html = renderProjectRoleSelection(empty, [
			{
				...candidate,
				label: '<script>alert("x")</script>',
				keyUseContract: "brc42-leaf-v1",
				publicDerivationLabel: "m/0'/1'",
			},
		]);
		for (const role of PROJECT_KEY_ROLES)
			expect(html).toContain(`name="roleAssignments[${role}]"`);
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
		expect(html).toContain('value="select:key-a" disabled');
		expect(html).toContain("Derived key profiles are not supported");
		expect(html).not.toContain('type="password"');
	});
});
