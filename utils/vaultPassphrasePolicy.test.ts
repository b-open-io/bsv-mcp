import { expect, test } from "bun:test";
import {
	assertPassphrase,
	vaultPassphraseIssue,
} from "./vaultPassphrasePolicy";

test("accepts a long passphrase without mixed classes", () => {
	expect(vaultPassphraseIssue("correct horse battery staple")).toBeUndefined();
	expect(() => assertPassphrase("correct horse battery staple")).not.toThrow();
});

test("rejects short and common secrets", () => {
	expect(vaultPassphraseIssue("short")).toMatch(/12/);
	expect(vaultPassphraseIssue("password1234")).toMatch(/common|12|16/);
	expect(vaultPassphraseIssue("abcdefghijkl")).toMatch(/16/);
});

test("does not trim surrounding spaces", () => {
	expect(vaultPassphraseIssue("  mixed Pass 12")).toBeUndefined();
});
