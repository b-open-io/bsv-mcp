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
		expect(roles("wallet_getAddress")).toEqual(["identity-signing", "one-sat"]);
		expect(roles("wallet_refreshUtxos")).toEqual([
			"identity-signing",
			"one-sat",
			"payments",
		]);
		expect(roles("wallet_getLockData")).toEqual(["one-sat"]);
		expect(roles("wallet_lockBsv")).toEqual(["one-sat", "payments"]);
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

	test("routes exact baskets and compact operations without a payment fallback", () => {
		expect(roles("wallet_listOutputs", { basket: "default" })).toEqual([
			"payments",
		]);
		expect(roles("wallet_listOutputs", { basket: "1sat" })).toEqual([
			"one-sat",
		]);
		for (const basket of [
			"1sat",
			"bsv21",
			"opns",
			"lock",
			"sigma",
			"bsocial",
			"bap",
		])
			expect(roles("wallet_listOutputs", { basket })).toEqual(["one-sat"]);
		for (const basket of [
			"ordinals",
			"custom",
			"1sat-deposit",
			"p 1sat ordinals",
		])
			expect(() =>
				resolveProjectToolPolicy("wallet_listOutputs", { basket }),
			).toThrow("PROJECT_TOOL_ROLE_AMBIGUOUS");
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

	test("uses asset baskets and permission labels for action routing", () => {
		expect(
			roles("wallet_createAction", {
				description: "asset",
				outputsJSON: JSON.stringify([
					{ basket: "1sat", satoshis: 1, lockingScript: "51" },
				]),
			}),
		).toEqual(["one-sat", "payments"]);
		expect(
			roles("wallet_createAction", {
				description: "asset",
				labelsJSON: JSON.stringify(["p bsv21 action"]),
			}),
		).toEqual(["one-sat", "payments"]);
		expect(
			roles("wallet_createAction", {
				description: "payment",
				outputsJSON: JSON.stringify([{ basket: "default" }]),
				labelsJSON: JSON.stringify(["ordinary-label"]),
			}),
		).toEqual(["payments"]);
		expect(
			roles("wallet_internalizeAction", {
				txJSON: "[]",
				outputsJSON: JSON.stringify([{ basket: "bsv21" }]),
				description: "asset",
			}),
		).toEqual(["one-sat"]);
		expect(() =>
			resolveProjectToolPolicy("wallet_createAction", {
				outputsJSON: JSON.stringify([{ basket: "custom" }]),
			}),
		).toThrow("PROJECT_TOOL_ROLE_AMBIGUOUS");
		expect(() =>
			resolveProjectToolPolicy("wallet_createAction", {
				outputsJSON: JSON.stringify([
					{ protocol: "basket insertion", insertionRemittance: {} },
				]),
			}),
		).toThrow("PROJECT_TOOL_ROLE_AMBIGUOUS");
		expect(() =>
			resolveProjectToolPolicy("wallet_createAction", {
				labelsJSON: JSON.stringify(["p future action"]),
			}),
		).toThrow("PROJECT_TOOL_ROLE_AMBIGUOUS");
	});

	test("routes app aliases and requires a sweep type", () => {
		for (const name of [
			"bsv_dashboard",
			"app_explorer_data",
			"app_ordinals_data",
			"app_sweep_scan",
		])
			expect(roles(name)).toEqual([]);
		expect(roles("app_wallet_data")).toEqual([
			"identity-signing",
			"one-sat",
			"payments",
		]);
		expect(roles("app_sweep_prepare", { sweepType: "bsv" })).toEqual([
			"payments",
		]);
		expect(roles("app_sweep_prepare", { sweepType: "ordinals" })).toEqual([
			"one-sat",
			"payments",
		]);
		expect(roles("app_sweep_prepare", { sweepType: "bsv21" })).toEqual([
			"one-sat",
			"payments",
		]);
		const complete = resolveProjectToolPolicy("app_sweep_complete", {
			reference: "opaque-reference",
			spends: {},
		});
		expect(complete.requiredRoles).toEqual([]);
		expect(complete.requiredContextGroups).toEqual(["wallet"]);
		expect(complete.vaultSupport).toBe("unsupported");
		expect(PROJECT_TOOL_POLICIES.app_sweep_prepare?.vaultSupport).toBe(
			"conditional",
		);
		expect(PROJECT_TOOL_POLICIES.app_sweep_complete?.vaultSupport).toBe(
			"unsupported",
		);
		expect(() =>
			resolveProjectToolPolicy("app_sweep_prepare", { sweepType: "future" }),
		).toThrow("PROJECT_TOOL_ARGUMENTS_INVALID");
	});

	test("marks raw-WIF wallet sweeps unsupported while retaining spend roles", () => {
		const bsv = resolveProjectToolPolicy("wallet_sweepBsv");
		expect(bsv.requiredRoles).toEqual(["payments"]);
		expect(bsv.vaultSupport).toBe("unsupported");
		for (const name of ["wallet_sweepOrdinals", "wallet_sweepBsv21"]) {
			const sweep = resolveProjectToolPolicy(name);
			expect(sweep.requiredRoles).toEqual(["one-sat", "payments"]);
			expect(sweep.vaultSupport).toBe("unsupported");
		}
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
		expect(() =>
			resolveProjectToolPolicy("bap_getId", { idKey: null }),
		).toThrow("PROJECT_TOOL_ARGUMENTS_INVALID");
		expect(() =>
			resolveProjectToolPolicy("wallet_createAction", {
				labelsJSON: JSON.stringify(["valid", 1]),
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
		expect(() => assertProjectToolAccounts(policy, null as never)).toThrow(
			"PROJECT_TOOL_ACCOUNTS_INVALID",
		);
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
		expect(() => assertProjectToolSession(policy, null as never, 4)).toThrow(
			"PROJECT_TOOL_SESSION_INVALID",
		);
		expect(() =>
			assertProjectToolSession(policy, { ...session, roles: null as never }, 4),
		).toThrow("PROJECT_TOOL_SESSION_INVALID");
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
