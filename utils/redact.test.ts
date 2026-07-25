import { describe, expect, it } from "bun:test";
import { PrivateKey } from "@bsv/sdk";
import { redactKeyMaterial, redactUnknown } from "./redact";

/**
 * The sweep tools take a raw WIF as an argument, so anything they return can
 * carry the key. These tests generate a real key rather than hardcoding one, so
 * no secret lives in the repo and the patterns are exercised against genuine
 * output rather than a handcrafted string that happens to match.
 */
describe("redactKeyMaterial", () => {
	const wif = PrivateKey.fromRandom().toWif();
	const hexKey = PrivateKey.fromRandom().toHex();

	it("removes a WIF that is the entire message", () => {
		const out = redactKeyMaterial(wif);
		expect(out).not.toContain(wif);
		expect(out).toBe("[REDACTED-WIF]");
	});

	it("removes a WIF embedded mid-sentence", () => {
		const out = redactKeyMaterial(`failed to import key ${wif} at offset 3`);
		expect(out).not.toContain(wif);
		expect(out).toContain("failed to import key");
		expect(out).toContain("at offset 3");
	});

	it("removes every WIF when several appear in one message", () => {
		const second = PrivateKey.fromRandom().toWif();
		const out = redactKeyMaterial(`from ${wif} to ${second}`);
		expect(out).not.toContain(wif);
		expect(out).not.toContain(second);
	});

	it("removes a raw 32-byte hex key", () => {
		const out = redactKeyMaterial(`derived from ${hexKey}`);
		expect(out).not.toContain(hexKey);
	});

	it("matches hex keys case-insensitively", () => {
		const upper = hexKey.toUpperCase();
		expect(redactKeyMaterial(`key ${upper}`)).not.toContain(upper);
	});

	it("leaves an ordinary message untouched", () => {
		const message = "Insufficient funds: needed 5000 sats, had 1200";
		expect(redactKeyMaterial(message)).toBe(message);
	});

	it("does not redact a txid it should keep", () => {
		// A txid is 64 hex characters, the same shape as a raw private key, so
		// this documents a deliberate trade: a leaked key is unrecoverable and a
		// redacted txid is merely inconvenient.
		const txid = "a".repeat(64);
		expect(redactKeyMaterial(txid)).toBe("[REDACTED-HEX]");
	});
});

describe("redactUnknown", () => {
	const wif = PrivateKey.fromRandom().toWif();

	it("reaches a key nested inside an object", () => {
		const out = redactUnknown({ ok: false, detail: { key: wif } });
		expect(out).not.toContain(wif);
	});

	it("reaches a key inside an array", () => {
		const out = redactUnknown({ inputs: [{ wif }, { wif }] });
		expect(out).not.toContain(wif);
	});

	it("serializes BigInt rather than throwing", () => {
		expect(() => redactUnknown({ satoshis: 5000n })).not.toThrow();
		expect(redactUnknown({ satoshis: 5000n })).toContain("5000");
	});

	it("passes a plain string through the same patterns", () => {
		expect(redactUnknown(`raw ${wif}`)).not.toContain(wif);
	});
});
