import { expect, test } from "bun:test";
import {
	type CreateActionArgs,
	P2PKH,
	PrivateKey,
	Transaction,
	UnlockingScript,
	type WalletInterface,
} from "@bsv/sdk";
import { X402Client } from "./x402";
import { serviceFetch } from "./x402-http";
import { canonical, parseChallenge, sha256 } from "./x402-protocol";

const script = new P2PKH().lock(PrivateKey.fromRandom().toAddress());
const terms = () => ({
	version: "bsv-tx-v1",
	challenge_id: "quote-1",
	amount_sats: 1000,
	payee_locking_script_hex: script.toHex(),
	expires_at: new Date(Date.now() + 60000).toISOString(),
});
function walletMock(
	counter: { calls: number },
	fee = 10,
	nonce?: Transaction,
): WalletInterface {
	return {
		listActions: async () => ({ totalActions: 0, actions: [] }),
		createAction: async (args: CreateActionArgs) => {
			counter.calls++;
			expect(args.options?.noSend).toBe(true);
			const parent = new Transaction(
				1,
				[],
				[{ satoshis: 2000, lockingScript: script }],
			);
			const inputs = [
				{
					sourceTransaction: parent,
					sourceOutputIndex: 0,
					unlockingScript: UnlockingScript.fromHex("51"),
				},
			];
			if (nonce) {
				expect(args.inputBEEF).toBeDefined();
				expect(args.inputs?.[0].outpoint).toBe(`${nonce.id("hex")}.0`);
				inputs.push({
					sourceTransaction: nonce,
					sourceOutputIndex: 0,
					unlockingScript: UnlockingScript.fromHex(""),
				});
			}
			const tx = new Transaction(1, inputs, [
				{
					satoshis: 1000,
					lockingScript: UnlockingScript.fromHex(
						args.outputs?.[0].lockingScript ?? script.toHex(),
					),
				},
				{
					satoshis: 1000 - fee + (nonce ? 1 : 0),
					lockingScript: new P2PKH().lock(PrivateKey.fromRandom().toAddress()),
				},
			]);
			return { tx: tx.toAtomicBEEF() };
		},
	} as unknown as WalletInterface;
}

test("generic service without keys preserves POST body and returns arbitrary paid data", async () => {
	const calls: { url: string; init: RequestInit }[] = [];
	const counter = { calls: 0 };
	const client = new X402Client({
		wallet: walletMock(counter),
		fetcher: (async (url, init = {}) => {
			calls.push({ url: String(url), init });
			const headers = new Headers(init.headers);
			expect(headers.has("X-API-Key")).toBe(false);
			if (headers.has("X402-Proof")) {
				const proof = JSON.parse(
					Buffer.from(headers.get("X402-Proof") ?? "", "base64url").toString(),
				);
				expect(
					Transaction.fromBinary([
						...Buffer.from(proof.rawtx_base64, "base64"),
					]).id("hex"),
				).toBe(proof.txid);
				return Response.json({ image: "https://service.example/result.png" });
			}
			return Response.json({ challenge: terms() }, { status: 402 });
		}) as typeof fetch,
	});
	const quote = await client.request({
		url: "https://service.example/render?size=large",
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: '{"prompt":"a cat"}',
	});
	expect(quote.status).toBe("payment_required");
	expect(counter.calls).toBe(0);
	await expect(client.pay(quote.quoteId ?? "", 999)).rejects.toThrow(
		"Spending limit",
	);
	const paid = await client.pay(quote.quoteId ?? "", 1010);
	expect(paid.status).toBe("paid_response");
	expect("body" in paid && paid.body).toContain("result.png");
	expect(calls.map((c) => c.url)).toEqual([
		"https://service.example/render?size=large",
		"https://service.example/render?size=large",
	]);
	expect(calls[1].init.body).toBe(calls[0].init.body);
	expect(calls[1].init.method).toBe("POST");
	await expect(client.pay(quote.quoteId ?? "", 1010)).rejects.toThrow(
		"already",
	);
	expect(counter.calls).toBe(1);
});

test("optional credentials stay at their origin; BananaBlocks is an ordinary POST", async () => {
	const requests: string[] = [];
	const client = new X402Client({
		serviceHeaders: { "https://bananablocks.com": { "X-API-Key": "test-key" } },
		fetcher: (async (url, init) => {
			requests.push(String(url));
			const headers = new Headers(init?.headers);
			if (String(url).startsWith("https://bananablocks.com")) {
				expect(headers.get("X-API-Key")).toBe("test-key");
				expect(init?.body).toBe('{"tier":"pro"}');
				return Response.json(
					{ challenge: { ...terms(), tier: "pro", duration_days: 30 } },
					{ status: 402 },
				);
			}
			expect(headers.has("X-API-Key")).toBe(false);
			return Response.json({ hello: "free" });
		}) as typeof fetch,
	});
	expect(
		(
			await client.request({
				url: "https://bananablocks.com/api/v1/key/upgrade",
				method: "POST",
				body: '{"tier":"pro"}',
				headers: { "Content-Type": "application/json" },
			})
		).status,
	).toBe("payment_required");
	expect(
		(await client.request({ url: "https://other.example/free" })).status,
	).toBe("response");
	expect(requests.length).toBe(2);
});

test("bound BRC-120 pays the server nonce and binds proof to the exact request", async () => {
	const nonce = new Transaction(
		1,
		[],
		[{ satoshis: 1, lockingScript: UnlockingScript.fromHex("51") }],
	);
	const request = {
		url: "https://service.example/resource?q=1",
		method: "POST",
		body: "payload",
		headers: { "content-type": "text/plain" },
		auth: "none" as const,
	};
	const challenge = {
		v: 1,
		scheme: "bsv-tx-v1",
		domain: "service.example",
		method: "POST",
		path: "/resource",
		query: "q=1",
		req_headers_sha256: sha256("content-type:text/plain\n"),
		req_body_sha256: sha256("payload"),
		amount_sats: 1000,
		payee_locking_script_hex: script.toHex(),
		nonce_utxo: {
			txid: nonce.id("hex"),
			vout: 0,
			satoshis: 1,
			locking_script_hex: "51",
		},
		expires_at: Math.floor(Date.now() / 1000) + 60,
		require_mempool_accept: true,
	};
	expect(() =>
		parseChallenge({ ...challenge, req_body_sha256: sha256("other") }, request),
	).toThrow("does not match");
	const counter = { calls: 0 };
	const client = new X402Client({
		wallet: walletMock(counter, 10, nonce),
		getBeef: async () => new Uint8Array(nonce.toBEEF()),
		fetcher: (async (_url, init) => {
			const header = new Headers(init?.headers).get("X402-Proof");
			if (!header)
				return new Response(null, {
					status: 402,
					headers: {
						"X402-Challenge": Buffer.from(canonical(challenge)).toString(
							"base64url",
						),
					},
				});
			const proof = JSON.parse(Buffer.from(header, "base64url").toString());
			expect(proof.challenge_sha256).toBe(sha256(canonical(challenge)));
			expect(proof.request.req_body_sha256).toBe(sha256("payload"));
			expect(proof.request.query).toBe("q=1");
			const tx = Transaction.fromBinary([
				...Buffer.from(proof.payment.rawtx_b64, "base64"),
			]);
			expect(tx.inputs.some((i) => i.sourceTXID === nonce.id("hex"))).toBe(
				true,
			);
			return new Response("paid content", {
				headers: { "content-type": "text/plain" },
			});
		}) as typeof fetch,
	});
	const quote = await client.request(request);
	expect((await client.pay(quote.quoteId ?? "", 1010)).status).toBe(
		"paid_response",
	);
	expect(counter.calls).toBe(1);
});

test("invalid quotes, fees, disabled payments and ambiguous writes never trigger a second payment", async () => {
	const req = {
		url: "https://service.example/task",
		method: "POST",
		headers: {},
		auth: "none" as const,
	};
	expect(() =>
		parseChallenge({ ...terms(), pay_url: "https://other.example/pay" }, req),
	).toThrow("origin");
	expect(() =>
		parseChallenge({ ...terms(), version: "unknown" }, req),
	).toThrow();
	expect(() =>
		parseChallenge(
			{ ...terms(), payee_address: PrivateKey.fromRandom().toAddress() },
			req,
		),
	).toThrow("does not match");
	const count = { calls: 0 };
	let submitted = 0;
	const fetcher = (async (_url: unknown, init?: RequestInit) => {
		if (new Headers(init?.headers).has("X402-Proof")) {
			submitted++;
			throw new Error("Connection lost");
		}
		return Response.json({ challenge: terms() }, { status: 402 });
	}) as typeof fetch;
	const disabled = new X402Client({
		wallet: walletMock(count),
		disabled: true,
		fetcher,
	});
	await expect(
		disabled.pay((await disabled.request(req)).quoteId ?? "", 1010),
	).rejects.toThrow("disabled");
	expect(count.calls).toBe(0);
	const expensive = new X402Client({ wallet: walletMock(count, 11), fetcher });
	expect(
		(await expensive.pay((await expensive.request(req)).quoteId ?? "", 1010))
			.status,
	).toBe("not_submitted");
	expect(submitted).toBe(0);
	const uncertain = new X402Client({ wallet: walletMock(count), fetcher });
	const quote = await uncertain.request(req);
	const pending = uncertain.pay(quote.quoteId ?? "", 1010);
	await expect(uncertain.pay(quote.quoteId ?? "", 1010)).rejects.toThrow(
		"already",
	);
	expect((await pending).status).toBe("outcome_unknown");
	await expect(uncertain.pay(quote.quoteId ?? "", 1010)).rejects.toThrow(
		"review",
	);
	expect(submitted).toBe(1);
});

test("HTTP transport refuses private addresses and credential-bearing URLs before connecting", async () => {
	await expect(serviceFetch("https://127.0.0.1/pay")).rejects.toThrow("public");
	await expect(
		serviceFetch("https://user:secret@example.com/pay"),
	).rejects.toThrow("credentials");
	await expect(serviceFetch("http://example.com/pay")).rejects.toThrow("HTTPS");
});

test("BRC-105 uses real SDK mutual authentication and wallet payment for a generic service", async () => {
	const { Peer, ProtoWallet, Utils } = await import("@bsv/sdk");
	type Message = import("@bsv/sdk").AuthMessage;
	let receive: (message: Message) => Promise<void> = async () => {};
	let reply: (response: Response) => void = () => {};
	const readString = (r: InstanceType<typeof Utils.Reader>) => {
		const length = r.readVarIntNum();
		return length < 0 ? "" : Utils.toUTF8(r.read(length));
	};
	const writeString = (w: InstanceType<typeof Utils.Writer>, s: string) => {
		const bytes = Utils.toArray(s, "utf8");
		w.writeVarIntNum(bytes.length);
		w.write(bytes);
	};
	const serverWallet = new ProtoWallet(PrivateKey.fromRandom());
	const serverPeer = new Peer(serverWallet as unknown as WalletInterface, {
		onData: async (cb) => {
			receive = cb;
		},
		send: async (message) => {
			if (message.messageType !== "general") {
				reply(Response.json(message));
				return;
			}
			const r = new Utils.Reader(message.payload ?? []);
			const id = Utils.toBase64(r.read(32));
			const status = r.readVarIntNum();
			const headers: Record<string, string> = {
				"x-bsv-auth-version": message.version,
				"x-bsv-auth-identity-key": message.identityKey,
				"x-bsv-auth-nonce": message.nonce ?? "",
				"x-bsv-auth-your-nonce": message.yourNonce ?? "",
				"x-bsv-auth-signature": Utils.toHex(message.signature ?? []),
				"x-bsv-auth-request-id": id,
			};
			const n = r.readVarIntNum();
			for (let i = 0; i < n; i++) headers[readString(r)] = readString(r);
			const length = r.readVarIntNum();
			reply(new Response(new Uint8Array(r.read(length)), { status, headers }));
		},
	});
	await serverPeer.ready;
	let paidCalls = 0;
	serverPeer.listenForGeneralMessages(
		async (sender: string, payload: number[]) => {
			const r = new Utils.Reader(payload);
			const nonce = r.read(32);
			const method = readString(r);
			const path = readString(r);
			readString(r);
			expect(method).toBe("POST");
			expect(path).toBe("/generate");
			const headers: Record<string, string> = {};
			const count = r.readVarIntNum();
			for (let i = 0; i < count; i++) headers[readString(r)] = readString(r);
			expect(readString(r)).toBe('{"prompt":"cat"}');
			const payment = headers["x-bsv-payment"];
			if (payment) {
				paidCalls++;
				const value = JSON.parse(payment);
				expect(value.derivationPrefix).toBe("service-nonce");
				expect(
					Transaction.fromAtomicBEEF([
						...Buffer.from(value.transaction, "base64"),
					]).outputs.some((o) => o.satoshis === 1000),
				).toBe(true);
			}
			const out = new Utils.Writer();
			out.write(nonce);
			out.writeVarIntNum(payment ? 200 : 402);
			const responseHeaders: Record<string, string> = payment
				? {}
				: {
						"x-bsv-payment-version": "1.0",
						"x-bsv-payment-satoshis-required": "1000",
						"x-bsv-payment-derivation-prefix": "service-nonce",
					};
			const pairs = Object.entries(responseHeaders).sort(([a], [b]) =>
				a.localeCompare(b),
			);
			out.writeVarIntNum(pairs.length);
			for (const [k, v] of pairs) {
				writeString(out, k);
				writeString(out, v);
			}
			writeString(out, payment ? "generated image" : "payment required");
			await serverPeer.toPeer(out.toArray(), sender);
		},
	);
	const fetcher = (async (url, init) =>
		new Promise<Response>((resolve, reject) => {
			reply = resolve;
			if (new URL(String(url)).pathname === "/.well-known/auth") {
				void receive(JSON.parse(String(init?.body))).catch(reject);
				return;
			}
			const h = new Headers(init?.headers);
			const u = new URL(String(url));
			const out = new Utils.Writer();
			out.write(Utils.toArray(h.get("x-bsv-auth-request-id") ?? "", "base64"));
			writeString(out, init?.method ?? "GET");
			writeString(out, u.pathname);
			if (u.search) writeString(out, u.search);
			else out.writeVarIntNum(-1);
			const pairs = [...h]
				.filter(
					([k]) =>
						(k.startsWith("x-bsv-") && !k.startsWith("x-bsv-auth")) ||
						k === "authorization" ||
						k === "content-type",
				)
				.sort(([a], [b]) => a.localeCompare(b));
			out.writeVarIntNum(pairs.length);
			for (const [k, v] of pairs) {
				writeString(out, k);
				writeString(out, v);
			}
			if (init?.body) writeString(out, String(init.body));
			else out.writeVarIntNum(-1);
			void receive({
				version: h.get("x-bsv-auth-version") ?? "",
				messageType: "general",
				identityKey: h.get("x-bsv-auth-identity-key") ?? "",
				nonce: h.get("x-bsv-auth-nonce") ?? undefined,
				yourNonce: h.get("x-bsv-auth-your-nonce") ?? undefined,
				signature: Utils.toArray(h.get("x-bsv-auth-signature") ?? "", "hex"),
				payload: out.toArray(),
			}).catch(reject);
		})) as typeof fetch;
	const counter = { calls: 0 };
	const wallet = Object.assign(
		new ProtoWallet(PrivateKey.fromRandom()),
		walletMock(counter),
	) as unknown as WalletInterface;
	const client = new X402Client({ wallet, fetcher });
	const quote = await client.request({
		url: "https://auth.example/generate",
		method: "POST",
		headers: { "content-type": "application/json" },
		body: '{"prompt":"cat"}',
		auth: "brc31",
	});
	expect(quote.status).toBe("payment_required");
	expect(counter.calls).toBe(0);
	const result = await client.pay(quote.quoteId ?? "", 1010);
	expect(result.status).toBe("paid_response");
	expect(counter.calls).toBe(1);
	expect(paidCalls).toBe(1);
}, 10000);
