import { afterEach, describe, expect, it } from "bun:test";
import { assertBroadcastAllowed, broadcastingDisabled } from "./broadcastGuard";

/**
 * The startup banner reports DISABLE_BROADCASTING as a safety switch. It
 * previously reached only the BAP tools, so a user could read
 * "Broadcasting: Disabled" and still move money through wallet_sendBsv. These
 * tests pin the switch to the same env the banner reads, so the two cannot
 * drift apart again.
 */
const original = process.env.DISABLE_BROADCASTING;

afterEach(() => {
	if (original === undefined) delete process.env.DISABLE_BROADCASTING;
	else process.env.DISABLE_BROADCASTING = original;
});

describe("broadcastingDisabled", () => {
	it("is off when the variable is unset", () => {
		delete process.env.DISABLE_BROADCASTING;
		expect(broadcastingDisabled()).toBe(false);
	});

	it("is on only for the exact string true", () => {
		process.env.DISABLE_BROADCASTING = "true";
		expect(broadcastingDisabled()).toBe(true);
	});

	it("stays off for values that merely look truthy", () => {
		for (const value of ["1", "yes", "TRUE", "True", ""]) {
			process.env.DISABLE_BROADCASTING = value;
			expect(broadcastingDisabled()).toBe(false);
		}
	});
});

describe("assertBroadcastAllowed", () => {
	it("permits the call when broadcasting is enabled", () => {
		delete process.env.DISABLE_BROADCASTING;
		expect(() => assertBroadcastAllowed("wallet_sendBsv")).not.toThrow();
	});

	it("refuses when broadcasting is disabled", () => {
		process.env.DISABLE_BROADCASTING = "true";
		expect(() => assertBroadcastAllowed("wallet_sendBsv")).toThrow();
	});

	it("names the tool and the variable so the refusal is actionable", () => {
		process.env.DISABLE_BROADCASTING = "true";
		try {
			assertBroadcastAllowed("mnee_sendMnee");
			throw new Error("should have refused");
		} catch (error) {
			const message = (error as Error).message;
			expect(message).toContain("mnee_sendMnee");
			expect(message).toContain("DISABLE_BROADCASTING");
		}
	});
});
