import { expect, test } from "bun:test";
import {
	defaultPaymentSelector,
	friendlySetupError,
	unusedAccountName,
} from "./setupCopy";

test("unusedAccountName keeps a free name and remaps default when taken", () => {
	expect(unusedAccountName("alice", [])).toBe("alice");
	expect(unusedAccountName("default", ["default"])).toBe("imported-wallet");
	expect(unusedAccountName("default", ["default", "imported-wallet"])).toBe(
		"imported-wallet-2",
	);
	expect(unusedAccountName("alice", ["alice"])).toBe("alice-2");
});

test("defaultPaymentSelector prefers the wallet just created", () => {
	const keys = [
		{ selector: "default:payment" },
		{ selector: "new-wallet:payment" },
	];
	expect(defaultPaymentSelector(keys, "default:payment", "new-wallet")).toBe(
		"new-wallet:payment",
	);
	expect(defaultPaymentSelector(keys, "default:payment")).toBe(
		"default:payment",
	);
	expect(defaultPaymentSelector(keys, undefined)).toBe(null);
	expect(
		defaultPaymentSelector([{ selector: "only:payment" }], undefined),
	).toBe("only:payment");
});

test("friendlySetupError tells the user how to continue", () => {
	expect(
		friendlySetupError(
			"The imported keys do not match the configured account address.",
			"default",
		),
	).toContain("different wallet name");
	expect(friendlySetupError("The vault binding does not match.")).toContain(
		"different payment key",
	);
	expect(friendlySetupError("Enter your Vault password.")).toBe(
		"Enter your Vault password.",
	);
});
