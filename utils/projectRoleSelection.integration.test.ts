import { afterEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrivateKey } from "@bsv/sdk";
import { writeAccount } from "./accounts";
import { SecureKeyManager } from "./keyManager";
import { PROJECT_KEY_ROLES } from "./projectRoleBindings";
import {
	loadProjectRoleBindings,
	saveProjectRoleBindings,
} from "./projectRoleBindingsStore";
import {
	type ProjectRoleCandidate,
	prepareProjectRoleSelection,
} from "./projectRoleSelection";
import { createAccountVaultMigrationBackend } from "./vaultMigrationBackend";

const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});
function temporaryProject() {
	const root = mkdtempSync(join(tmpdir(), "role-selection-integration-"));
	roots.push(root);
	return root;
}
const publicKey = PrivateKey.fromHex("1").toPublicKey().toString();
const candidate: ProjectRoleCandidate = {
	candidateId: "opaque-key",
	label: "Public candidate",
	accountId: "trusted-account",
	key: {
		vaultId: "trusted-vault",
		entryId: "trusted-entry",
		expectedPublicKey: publicKey,
	},
	keyUseContract: "direct-v1",
	supportedRoles: PROJECT_KEY_ROLES,
};
const allSelected = {
	"identity-signing": "select:opaque-key",
	payments: "select:opaque-key",
	"one-sat": "select:opaque-key",
	encryption: "select:opaque-key",
};
const metadata = {
	expectedProjectId: "project",
	now: "2026-09-08T12:00:00Z",
	createBindingId: (role: string) => `${role}-first`,
};

describe("role selection with the real project store", () => {
	test("all four initial selections persist at revision zero, then one batch preserves history", async () => {
		const root = temporaryProject();
		const first = prepareProjectRoleSelection(
			null,
			[candidate],
			{
				expectedProjectId: "project",
				expectedRevision: null,
				roleAssignments: allSelected,
			},
			metadata,
		);
		await saveProjectRoleBindings(root, first, {
			expectedProjectId: "project",
			expectedRevision: null,
		});
		const persisted = await loadProjectRoleBindings(root, "project");
		expect(persisted?.revision).toBe(0);
		expect(persisted?.bindings).toHaveLength(4);
		const next = prepareProjectRoleSelection(
			persisted,
			[candidate],
			{
				expectedProjectId: "project",
				expectedRevision: 0,
				roleAssignments: {
					"identity-signing": "keep:identity-signing-first",
					payments: "select:opaque-key",
					"one-sat": "unassigned",
					encryption: "keep:encryption-first",
				},
			},
			{ ...metadata, createBindingId: (role) => `${role}-second` },
		);
		await saveProjectRoleBindings(root, next, {
			expectedProjectId: "project",
			expectedRevision: 0,
		});
		const final = await loadProjectRoleBindings(root, "project");
		expect(final?.revision).toBe(1);
		expect(final?.current).toEqual({
			"identity-signing": "identity-signing-first",
			payments: "payments-second",
			"one-sat": null,
			encryption: "encryption-first",
		});
		expect(final?.bindings).toHaveLength(5);
		expect(final?.retained.map((item) => item.bindingId)).toEqual([
			"payments-first",
			"one-sat-first",
		]);
	});
	test("forged browser key/account data and unsupported profiles never reach storage", async () => {
		const root = temporaryProject();
		const request = {
			expectedProjectId: "project",
			expectedRevision: null,
			roleAssignments: allSelected,
		};
		for (const extra of [
			{ accountId: "forged" },
			{ key: candidate.key },
			{ candidates: [candidate] },
		])
			expect(() =>
				prepareProjectRoleSelection(
					null,
					[candidate],
					{ ...request, ...extra },
					metadata,
				),
			).toThrow();
		expect(() =>
			prepareProjectRoleSelection(
				null,
				[{ ...candidate, keyUseContract: "brc42-leaf-v1" }],
				request,
				metadata,
			),
		).toThrow("PROJECT_ROLE_CANDIDATE_UNAVAILABLE");
		expect(await loadProjectRoleBindings(root, "project")).toBeNull();
	});
});

const specifier = process.env.BSV_VAULT_TEST_MODULE ?? "@opl.dev/vault";
const actual = await import(specifier).catch(() => undefined);
describe.skipIf(!actual)(
	"role choices through the actual migration backend",
	() => {
		test("opaque import candidates become verified persisted references for four explicit roles", async () => {
			const root = temporaryProject(),
				project = join(root, "project"),
				accounts = join(root, "accounts"),
				vaultPath = join(root, "vault", "keys.bep");
			mkdirSync(project);
			await new SecureKeyManager({
				keyDir: join(accounts, "selected"),
			}).saveKeys(
				{ payPk: PrivateKey.fromHex("1"), identityPk: PrivateKey.fromHex("2") },
				{ passphrase: "source-password" },
			);
			writeAccount(
				"selected",
				{
					chain: "test",
					storageIdentityKey: "synthetic",
					depositPrefix: "mcp",
				},
				accounts,
			);
			const original = readFileSync(join(accounts, "selected", "keys.bep"));
			const backend = await createAccountVaultMigrationBackend({
				projectRoot: project,
				expectedProjectId: "project",
				vaultPath,
				accountsDirectory: accounts,
				loadModule: async () => actual,
			});
			const source = {
				account: "selected",
				location: "account" as const,
				encryptedBackup: true,
				plaintextKeys: false,
				walletDatabases: [],
			};
			const destination = {
				accountName: "selected",
				vaultPath,
				vaultEntryId: "new",
			};
			const session = await backend.beginUnlock({
				...destination,
				source,
				sourcePassphrase: "source-password",
				destinationPassphrase: "destination-password",
			});
			try {
				const preview = await backend.preview({
					sessionId: session.sessionId,
					source,
					destination,
				});
				expect(preview.projectRoles?.current).toBeNull();
				expect(
					preview.projectRoles?.candidates
						.map((item) => item.candidateId)
						.sort(),
				).toEqual(["identity", "payment"]);
				const roleSelection = {
					expectedProjectId: "project",
					expectedRevision: null,
					roleAssignments: {
						"identity-signing": "select:identity",
						payments: "select:payment",
						"one-sat": "select:payment",
						encryption: "select:identity",
					},
				};
				for (const forged of [
					{ ...roleSelection, accountId: "attacker-account" },
					{ ...roleSelection, key: candidate.key },
					{
						...roleSelection,
						roleAssignments: {
							...roleSelection.roleAssignments,
							payments: "select:not-in-preview",
						},
					},
					{
						...roleSelection,
						roleAssignments: {
							...roleSelection.roleAssignments,
							payments: "select:identity",
						},
					},
				]) {
					await expect(
						backend.cutover({
							sessionId: session.sessionId,
							source,
							destination,
							confirmation: "MIGRATE_AND_SWITCH",
							resolutions: {},
							roleSelection: forged,
						}),
					).rejects.toThrow();
					expect(existsSync(vaultPath)).toBe(false);
					expect(await loadProjectRoleBindings(project, "project")).toBeNull();
				}
				const result = await backend.cutover({
					sessionId: session.sessionId,
					source,
					destination,
					confirmation: "MIGRATE_AND_SWITCH",
					resolutions: {},
					roleSelection,
				});
				expect(result.verified).toBe(true);
				const config = await loadProjectRoleBindings(project, "project");
				expect(config?.revision).toBe(0);
				expect(config?.bindings).toHaveLength(4);
				for (const binding of config?.bindings ?? []) {
					expect(binding.accountId).toBe("selected");
					expect(["identity", "payment"]).not.toContain(binding.key.entryId);
					expect(binding.key.expectedPublicKey).toBe(
						PrivateKey.fromHex(
							binding.role === "payments" || binding.role === "one-sat"
								? "1"
								: "2",
						)
							.toPublicKey()
							.toString(),
					);
				}
				expect(readFileSync(join(accounts, "selected", "keys.bep"))).toEqual(
					original,
				);
			} finally {
				await backend.lock(session.sessionId);
			}
		});
	},
);
