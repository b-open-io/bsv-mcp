import { describe, expect, test } from "bun:test";
import {
	assertProjectToolAccounts,
	assertProjectToolSession,
	assertProjectToolSupported,
	PROJECT_TOOL_POLICIES,
	ProjectToolRoleError,
	resolveProjectToolPolicy,
} from "./projectToolRoles";

function roles(toolName: string, args?: unknown) {
	return [...resolveProjectToolPolicy(toolName, args).requiredRoles];
}

describe("project tool role routing", () => {
	test("maps payment, asset, identity and encryption tools explicitly", () => {
		expect(roles("wallet_sendBsv")).toEqual(["payments"]);
		expect(roles("wallet_getOrdinals")).toEqual(["one-sat"]);
		expect(roles("wallet_refreshUtxos")).toEqual(["one-sat", "payments"]);
		expect(roles("wallet_signBsm")).toEqual(["identity-signing"]);
		expect(roles("wallet_encrypt")).toEqual(["encryption"]);
		expect(
			resolveProjectToolPolicy("wallet_encrypt").requiredContextGroups,
		).toEqual(["encryption"]);
	});

	test("requires an identity role for identity public-key access", () => {
		expect(roles("wallet_getPublicKey", { identityKey: true })).toEqual([
			"identity-signing",
		]);
		expect(() => resolveProjectToolPolicy("wallet_getPublicKey", {})).toThrow(
			"PROJECT_TOOL_ROLE_AMBIGUOUS",
		);
		expect(() => resolveProjectToolPolicy("wallet_getPublicKey")).toThrow(
			"PROJECT_TOOL_ROLE_AMBIGUOUS",
		);
	});

	test("does not select identity for caller-supplied public BAP lookups", () => {
		expect(roles("bap_getId", { idKey: "0279be" })).toEqual([]);
		expect(roles("bap_getId", {})).toEqual(["identity-signing"]);
		expect(roles("bap_getId")).toEqual(["identity-signing"]);
	});

	test("asset transactions include fee compatibility and optional BAP signing", () => {
		const transfer = resolveProjectToolPolicy("wallet_transferOrdToken");
		expect(transfer.requiredRoles).toEqual(["one-sat", "payments"]);
		expect(transfer.feeRole).toBe("payments");
		expect(transfer.accountConstraint).toBe("same-account");
		expect(roles("wallet_createOrdinals", { signWithBAP: true })).toEqual([
			"one-sat",
			"payments",
			"identity-signing",
		]);
		expect(roles("wallet_createOrdinals", { signWithBAP: false })).toEqual([
			"one-sat",
			"payments",
		]);
		for (const toolName of [
			"wallet_listOrdinal",
			"wallet_cancelListing",
			"wallet_opnsRegister",
			"wallet_opnsDeregister",
			"wallet_purchaseListing",
		])
			expect(roles(toolName)).toEqual(["one-sat", "payments"]);
	});

	test("routes baskets and compact operations without a payment fallback", () => {
		expect(roles("wallet_listOutputs", { basket: "default" })).toEqual([
			"payments",
		]);
		expect(roles("wallet_listOutputs", { basket: "ordinals" })).toEqual([
			"one-sat",
			"payments",
		]);
		expect(() => resolveProjectToolPolicy("wallet_listOutputs", {})).toThrow(
			"PROJECT_TOOL_ROLE_AMBIGUOUS",
		);
		expect(
			roles("wallet_read", { operation: "wallet_getOrdinals", args: {} }),
		).toEqual(["one-sat"]);
		expect(roles("bsv_read", { operation: "bsv_status", args: {} })).toEqual(
			[],
		);
	});

	test("rejects unknown tools and malformed conditional arguments", () => {
		for (const value of ["", "wallet_notRegistered"]) {
			expect(() => resolveProjectToolPolicy(value)).toThrow(
				"PROJECT_TOOL_UNKNOWN",
			);
		}
		expect(() =>
			resolveProjectToolPolicy("wallet_createAction", {
				outputsJSON: "{broken",
			}),
		).toThrow("PROJECT_TOOL_ARGUMENTS_INVALID");
	});

	test("fails closed for cross-account fee or signer composition", () => {
		const policy = resolveProjectToolPolicy("wallet_transferOrdToken");
		expect(() =>
			assertProjectToolAccounts(policy, {
				"one-sat": "assets",
				payments: "fees",
			}),
		).toThrow("PROJECT_TOOL_CROSS_ACCOUNT_UNSUPPORTED");
		expect(
			assertProjectToolAccounts(policy, {
				"one-sat": "same-account",
				payments: "same-account",
			}),
		).toEqual({ "one-sat": "same-account", payments: "same-account" });
		expect(() =>
			assertProjectToolAccounts(policy, { "one-sat": "same-account" }),
		).toThrow("PROJECT_TOOL_ROLE_UNASSIGNED");
	});

	test("requires refreshed role snapshots after project binding changes", () => {
		const policy = resolveProjectToolPolicy("wallet_createOrdinals");
		const session = {
			projectId: "project-a",
			revision: 4,
			roles: {
				"one-sat": { accountId: "account-a", revision: 4 },
				payments: { accountId: "account-a", revision: 4 },
			},
		};
		expect(assertProjectToolSession(policy, session, 4)).toEqual({
			"one-sat": "account-a",
			payments: "account-a",
		});
		expect(() =>
			assertProjectToolSession(policy, session, 4, "project-b"),
		).toThrow("PROJECT_TOOL_PROJECT_MISMATCH");
		expect(() => assertProjectToolSession(policy, session, 5)).toThrow(
			"PROJECT_TOOL_SESSION_REFRESH_REQUIRED",
		);
		expect(() =>
			assertProjectToolSession(
				resolveProjectToolPolicy("wallet_encrypt"),
				{
					...session,
					roles: {
						encryption: { accountId: "account-a", revision: 3 },
					},
				},
				4,
			),
		).toThrow("PROJECT_TOOL_SESSION_REFRESH_REQUIRED");
	});

	test("marks legacy tools explicitly unsupported in Vault mode", () => {
		const policy = resolveProjectToolPolicy("bap_generate");
		expect(policy.vaultSupport).toBe("unsupported");
		expect(() => assertProjectToolSupported(policy)).toThrow(
			"PROJECT_TOOL_VAULT_UNSUPPORTED",
		);
		expect(PROJECT_TOOL_POLICIES.bap_friend?.vaultSupport).toBe("unsupported");
		expect(() => new ProjectToolRoleError("TEST", "test")).toThrow("TEST");
	});
});
