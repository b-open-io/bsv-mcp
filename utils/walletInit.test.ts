import { describe, expect, it } from "bun:test";
import { WalletPermissionsManager } from "@bsv/wallet-toolbox/out/src/index.client.js";
import { ADMIN_ORIGINATOR } from "./walletInit";

/**
 * The admin originator bypasses every permission check — isAdminOriginator
 * short-circuits ensureSpendingAuthorization to true before the spending gate
 * runs. These tests pin the two ways that bypass can be opened by accident.
 */
/**
 * isAdminOriginator is private on the class, so reach it through an unknown
 * cast rather than reimplementing the comparison here — a copy of the logic
 * would pass while the real check drifted.
 */
type OriginatorCheck = { isAdminOriginator(value?: string): boolean };

function makeManager(): OriginatorCheck {
	const underlying = {} as ConstructorParameters<
		typeof WalletPermissionsManager
	>[0];
	return new WalletPermissionsManager(
		underlying,
		ADMIN_ORIGINATOR,
	) as unknown as OriginatorCheck;
}

describe("admin originator", () => {
	it("is not a string any tool would pass as an originator", () => {
		// It was the package name, which is exactly what a caller reaches for
		// when a parameter called `originator` wants a value.
		expect(ADMIN_ORIGINATOR).not.toBe("bsv-mcp");
		expect(ADMIN_ORIGINATOR).not.toBe("bsv_mcp");
	});

	it("does not normalize to the empty string", () => {
		// normalizeOriginator(undefined) returns "". An admin originator that
		// also normalized to "" would make every anonymous call admin and
		// disable the spending gate for the whole server.
		expect(ADMIN_ORIGINATOR.trim()).not.toBe("");
	});

	it("is not matched by an absent originator", () => {
		// Every @1sat/actions call reaches wallet.createAction with a single
		// argument, so originator is undefined. That must not read as admin.
		const manager = makeManager();

		expect(manager.isAdminOriginator(undefined)).toBe(false);
		expect(manager.isAdminOriginator("")).toBe(false);
		expect(manager.isAdminOriginator("bsv-mcp")).toBe(false);
	});

	it("still recognises itself, so the escape hatch remains usable", () => {
		const manager = makeManager();

		expect(manager.isAdminOriginator(ADMIN_ORIGINATOR)).toBe(true);
	});
});
