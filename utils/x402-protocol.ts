import { createHash } from "node:crypto";
import { P2PKH } from "@bsv/sdk";
import { z } from "zod";

export const sha256 = (value: string | Uint8Array) =>
	createHash("sha256").update(value).digest("hex");
export function canonical(value: unknown): string {
	if (
		typeof value === "string" &&
		/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
			value,
		)
	)
		throw new Error("Invalid Unicode in challenge");
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value !== null && typeof value === "object")
		return `{${Object.keys(value)
			.sort()
			.map(
				(k) =>
					`${canonical(k)}:${canonical((value as Record<string, unknown>)[k])}`,
			)
			.join(",")}}`;
	return JSON.stringify(value);
}
const hex = z.string().regex(/^[0-9a-f]{64}$/);
const script = z
	.string()
	.regex(/^(?:[0-9a-fA-F]{2})+$/)
	.max(20000);
const amount = z.number().int().positive().max(2_100_000_000_000_000);
const compact = z
	.object({
		version: z.literal("bsv-tx-v1"),
		challenge_id: z.string().min(1).max(256),
		amount_sats: amount,
		payee_locking_script_hex: script,
		payee_address: z.string().optional(),
		expires_at: z.string().datetime({ offset: true }),
		pay_url: z.string().optional(),
	})
	.passthrough();
const bound = z
	.object({
		v: z.literal(1),
		scheme: z.literal("bsv-tx-v1"),
		domain: z.string(),
		method: z.string(),
		path: z.string(),
		query: z.string(),
		req_headers_sha256: hex,
		req_body_sha256: hex,
		amount_sats: amount,
		payee_locking_script_hex: script,
		nonce_utxo: z.object({
			txid: hex,
			vout: z.number().int().nonnegative().max(0xffffffff),
			satoshis: amount,
			locking_script_hex: script,
		}),
		expires_at: z.number().int().positive().optional(),
		require_mempool_accept: z.boolean(),
	})
	.passthrough();
export type HttpRequest = {
	url: string;
	method: string;
	body?: string | Uint8Array<ArrayBuffer>;
	headers: Record<string, string>;
	boundHeaders?: string[];
	auth: "none" | "brc31";
};
export function parseChallenge(raw: unknown, request: HttpRequest) {
	const url = new URL(request.url);
	if (raw && typeof raw === "object" && "v" in raw) {
		const ch = bound.parse(raw);
		const names = request.boundHeaders ?? Object.keys(request.headers);
		const binding = names
			.map((n) => n.toLowerCase())
			.sort()
			.map((n) => `${n}:${(request.headers[n] ?? "").trim()}\n`)
			.join("");
		if (
			ch.domain !== url.host ||
			ch.method !== request.method ||
			ch.path !== url.pathname ||
			ch.query !== url.search.slice(1) ||
			ch.req_body_sha256 !== sha256(request.body ?? "") ||
			ch.req_headers_sha256 !== sha256(binding)
		)
			throw new Error(
				"Payment challenge does not match the request URL, method, headers, or body",
			);
		if (ch.nonce_utxo.locking_script_hex !== "51")
			throw new Error(
				"This nonce requires a custom unlocking solution; only OP_TRUE server nonces are supported",
			);
		return {
			kind: "bound" as const,
			raw: ch,
			id: sha256(canonical(ch)),
			amount: ch.amount_sats,
			script: ch.payee_locking_script_hex,
			expires: ch.expires_at ? ch.expires_at * 1000 : Date.now() + 300000,
			payUrl: request.url,
		};
	}
	const ch = compact.parse(raw);
	if (
		ch.payee_address &&
		new P2PKH().lock(ch.payee_address).toHex().toLowerCase() !==
			ch.payee_locking_script_hex.toLowerCase()
	)
		throw new Error("Quoted address does not match payment script");
	const payUrl = new URL(ch.pay_url ?? request.url, request.url);
	if (
		payUrl.origin !== url.origin ||
		payUrl.username ||
		payUrl.password ||
		payUrl.hash
	)
		throw new Error(
			"Payment submission URL must remain on the requested service origin",
		);
	return {
		kind: "compact" as const,
		raw: ch,
		id: ch.challenge_id,
		amount: ch.amount_sats,
		script: ch.payee_locking_script_hex,
		expires: Date.parse(ch.expires_at),
		payUrl: payUrl.toString(),
	};
}
export type RawChallenge = ReturnType<typeof parseChallenge>;
