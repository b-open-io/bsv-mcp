/**
 * Key-material redaction for anything a tool hands back to a caller.
 *
 * The sweep tools take a raw WIF as an argument, so any string they return can
 * carry the key. Each of them defined this regex inline and then applied it to
 * exactly one of three exit paths — the thrown-exception branch — while the
 * `result.error` branch and the serialized success payload both returned raw.
 * One implementation, applied at the boundary, closes all three.
 */

/** Uncompressed (5...) and compressed (K/L...) mainnet WIF keys. */
const WIF_PATTERN = /[5KL][1-9A-HJ-NP-Za-km-z]{50,51}/g;

/** Raw 32-byte private keys and seeds written as hex. */
const HEX_KEY_PATTERN = /\b[0-9a-f]{64}\b/gi;

/** Testnet WIFs, which the mainnet prefixes above do not cover. */
const TESTNET_WIF_PATTERN = /\b[9c][1-9A-HJ-NP-Za-km-z]{50,51}\b/g;

/** Extended private keys. */
const XPRV_PATTERN = /\bxprv[1-9A-HJ-NP-Za-km-z]{50,}\b/g;

export function redactKeyMaterial(text: string): string {
	return text
		.replace(WIF_PATTERN, "[REDACTED-WIF]")
		.replace(TESTNET_WIF_PATTERN, "[REDACTED-WIF]")
		.replace(XPRV_PATTERN, "[REDACTED-XPRV]")
		.replace(HEX_KEY_PATTERN, "[REDACTED-HEX]");
}

/**
 * Redact an arbitrary value on its way out of a tool. Serializes first so key
 * material nested anywhere in an object is caught, not just top-level strings.
 * BigInt is stringified because JSON.stringify throws on it and several of the
 * SDK's results carry satoshi amounts as BigInt.
 */
export function redactUnknown(value: unknown, space?: number): string {
	const serialized =
		typeof value === "string"
			? value
			: JSON.stringify(
					value,
					(_, v) => (typeof v === "bigint" ? v.toString() : v),
					space,
				);

	return redactKeyMaterial(serialized ?? String(value));
}
