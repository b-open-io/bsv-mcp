import { randomUUID } from "node:crypto";
import {
	type AuthFetch,
	type CreateActionArgs,
	type CreateActionResult,
	Transaction,
	type WalletInterface,
} from "@bsv/sdk";
import { authenticatedClient } from "./x402-auth";
import { MAX_BODY, requestURL, serviceFetch } from "./x402-http";
import {
	canonical,
	type HttpRequest,
	parseChallenge,
	type RawChallenge,
	sha256,
} from "./x402-protocol";

type AuthTerms = {
	kind: "brc105";
	id: string;
	amount: number;
	expires: number;
	payee: string;
	prefix: string;
	action: CreateActionArgs;
};
type Quote = {
	request: HttpRequest;
	terms: RawChallenge | AuthTerms;
	attempted: boolean;
	authClient?: AuthFetch;
	startAuth?: () => void;
	stopAuth?: () => void;
	authContentType?: () => string | null;
};
class QuoteCaptured extends Error {
	constructor(readonly action: CreateActionArgs) {
		super("Payment requires authorization");
	}
}
function authTerms(args: CreateActionArgs): AuthTerms {
	if (args.outputs?.length !== 1 || args.inputs?.length)
		throw new Error("Unexpected BRC-105 payment shape");
	const output = args.outputs[0];
	if (output === undefined) throw new Error("Unexpected BRC-105 payment shape");
	const details = JSON.parse(output.customInstructions ?? "{}");
	if (
		!Number.isSafeInteger(output.satoshis) ||
		output.satoshis <= 0 ||
		typeof details.payee !== "string" ||
		!/^(02|03)[a-f0-9]{64}$/i.test(details.payee) ||
		typeof details.derivationPrefix !== "string" ||
		!details.derivationPrefix
	)
		throw new Error("Invalid BRC-105 payment requirements");
	return {
		kind: "brc105",
		id: sha256(`${details.payee}:${details.derivationPrefix}`),
		amount: output.satoshis,
		expires: Date.now() + 300000,
		payee: details.payee,
		prefix: details.derivationPrefix,
		action: args,
	};
}
function safeHeaders(headers: Record<string, string>): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [name, value] of new Headers(headers)) {
		if (
			/^(host|connection|content-length|transfer-encoding|upgrade|cookie|proxy-.*|x402-.*|payment-.*|x-bsv-payment.*|x-bsv-auth.*)$/i.test(
				name,
			)
		)
			throw new Error(`Reserved request header: ${name}`);
		result[name] = value;
	}
	return result;
}
async function resultBody(response: Response, typeHint?: string | null) {
	const bytes = new Uint8Array(await response.arrayBuffer());
	if (bytes.length > MAX_BODY)
		throw new Error("Service response exceeds 1 MiB");
	const contentType =
		typeHint ??
		response.headers.get("content-type") ??
		"application/octet-stream";
	const text = /^text\/|json|xml/.test(contentType);
	return {
		httpStatus: response.status,
		contentType,
		body: text
			? Buffer.from(bytes).toString("utf8")
			: Buffer.from(bytes).toString("base64"),
		encoding: text ? "utf8" : "base64",
	};
}

/** Generic BSV paid HTTP requests. Service URLs, operations, and responses are not provider-specific. */
export class X402Client {
	private quotes = new Map<string, Quote>();
	private attempted = new Set<string>();
	private blocked = false;
	private fetcher: typeof fetch;
	constructor(
		private config: {
			wallet?: WalletInterface;
			disabled?: boolean;
			serviceHeaders?: Record<string, Record<string, string>>;
			getBeef?: (txid: string) => Promise<Uint8Array>;
			fetcher?: typeof fetch;
		},
	) {
		this.fetcher = config.fetcher ?? (serviceFetch as typeof fetch);
		for (const [origin, headers] of Object.entries(
			config.serviceHeaders ?? {},
		)) {
			if (requestURL(origin).origin !== origin)
				throw new Error(
					"Service credentials must be keyed by an exact HTTPS origin, without a path",
				);
			safeHeaders(headers);
		}
	}
	async request(input: {
		url: string;
		method?: string;
		body?: string;
		bodyEncoding?: "utf8" | "base64";
		headers?: Record<string, string>;
		boundHeaders?: string[];
		auth?: "none" | "brc31";
	}) {
		const url = requestURL(input.url);
		const method = input.method?.toUpperCase() ?? "GET";
		if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method))
			throw new Error("Unsupported HTTP method");
		if (["GET", "HEAD"].includes(method) && input.body !== undefined)
			throw new Error("GET and HEAD requests cannot carry a body");

		if (
			input.bodyEncoding === "base64" &&
			input.body !== undefined &&
			!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
				input.body,
			)
		)
			throw new Error("Invalid base64 request body");
		const body =
			input.bodyEncoding === "base64" && input.body !== undefined
				? new Uint8Array(Buffer.from(input.body, "base64"))
				: input.body;
		if (
			(typeof body === "string"
				? Buffer.byteLength(body)
				: (body?.length ?? 0)) > MAX_BODY
		)
			throw new Error("Request body exceeds 1 MiB");
		const request: HttpRequest = {
			url: url.toString(),
			method,
			body,
			headers: {
				...safeHeaders(input.headers ?? {}),
				...safeHeaders(this.config.serviceHeaders?.[url.origin] ?? {}),
			},
			boundHeaders: input.boundHeaders,
			auth: input.auth ?? "none",
		};
		for (const [id, q] of this.quotes)
			if (q.terms.expires <= Date.now()) this.quotes.delete(id);
		if (this.quotes.size >= 100)
			throw new Error("Too many open quotes; wait for quotes to expire");
		let response: Response;
		let quote: Quote;
		if (request.auth === "brc31") {
			if (!this.config.wallet)
				throw new Error(
					"Connect a BRC-100 wallet to authenticate this request",
				);
			// SDK handles identity, derivation, and BEEF transport; it cannot spend without our callback.
			const capture = async (
				args: CreateActionArgs,
			): Promise<CreateActionResult> => {
				throw new QuoteCaptured(args);
			};
			let resourceCalls = 0;
			let handshakeCalls = 0;
			let active = true;
			let responseContentType: string | null = null;
			const transportFetch = (async (
				target: string | URL | Request,
				init?: RequestInit,
			) => {
				if (!active)
					throw new Error("Authenticated request is no longer active");
				const targetURL = requestURL(String(target));
				if (targetURL.origin !== url.origin)
					throw new Error("Authentication cannot leave the service origin");
				if (targetURL.pathname === "/.well-known/auth") {
					if (++handshakeCalls > 4)
						throw new Error("Authentication handshake limit exceeded");
				} else {
					if (
						targetURL.toString() !== request.url ||
						(init?.method ?? "GET") !== method ||
						++resourceCalls > 1
					)
						throw new Error("Unexpected authenticated request or retry");
				}
				const response = await this.fetcher(target, init);
				if (targetURL.pathname !== "/.well-known/auth")
					responseContentType = response.headers.get("content-type");
				return response;
			}) as typeof fetch;
			const client = authenticatedClient(
				this.config.wallet,
				url.origin,
				transportFetch,
				capture,
			);
			try {
				response = await timed(
					client.fetch(request.url, {
						method,
						headers: request.headers,
						body:
							request.body ??
							(["GET", "HEAD"].includes(method) ? undefined : ""),
						retryCounter: 1,
						paymentRetryAttempts: 0,
					}),
				);
				return {
					status: "response",
					...(await resultBody(response, responseContentType)),
				};
			} catch (error) {
				if (!(error instanceof QuoteCaptured)) throw error;
				quote = {
					request,
					terms: authTerms(error.action),
					attempted: false,
					authClient: client,
					authContentType: () => responseContentType,
					startAuth: () => {
						active = true;
						resourceCalls = 0;
						handshakeCalls = 0;
					},
					stopAuth: () => {
						active = false;
					},
				};
			} finally {
				active = false;
			}
		} else {
			response = await this.fetcher(request.url, {
				method,
				body: request.body,
				headers: request.headers,
			});
			if (response.status !== 402)
				return { status: "response", ...(await resultBody(response)) };
			if (response.headers.has("x-bsv-payment-version"))
				throw new Error(
					"This service uses BRC-105. Repeat the request with auth: brc31 to obtain an authenticated quote",
				);
			const header = response.headers.get("X402-Challenge");
			let raw: unknown;
			if (header) {
				raw = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
				await response.body?.cancel();
			} else {
				const body = await resultBody(response);
				raw = JSON.parse(body.body).challenge;
			}
			quote = {
				request,
				terms: parseChallenge(raw, request),
				attempted: false,
			};
		}
		this.checkExpiry(quote);
		const quoteId = randomUUID();
		this.quotes.set(quoteId, quote);
		return {
			status: "payment_required",
			quoteId,
			url: request.url,
			method,
			bodySha256: sha256(request.body ?? ""),
			protocol: quote.terms.kind,
			amountSats: quote.terms.amount,
			miningFeeIncluded: false,
			expiresAt: new Date(quote.terms.expires).toISOString(),
			terms:
				quote.terms.kind === "brc105"
					? { payeeIdentityKey: quote.terms.payee }
					: quote.terms.raw,
		};
	}
	private checkExpiry(quote: Quote) {
		if (quote.terms.expires <= Date.now())
			throw new Error("Payment quote expired; request again before paying");
	}
	async pay(quoteId: string, maxTotalSats: number) {
		if (this.config.disabled)
			throw new Error("Payments disabled by DISABLE_BROADCASTING");
		const wallet = this.config.wallet;
		if (!wallet) throw new Error("Connect a BRC-100 wallet before paying");
		if (this.blocked)
			throw new Error(
				"A prior payment needs review; check wallet history and the service before further payment",
			);
		const quote = this.quotes.get(quoteId);
		if (!quote)
			throw new Error(
				"Unknown quote; send the request in this MCP session first",
			);
		this.checkExpiry(quote);
		const terms = quote.terms;
		if (!Number.isSafeInteger(maxTotalSats) || maxTotalSats < terms.amount)
			throw new Error("Spending limit must cover price plus mining fees");
		const key = sha256(`${new URL(quote.request.url).origin}:${terms.id}`);
		if (quote.attempted || this.attempted.has(key))
			throw new Error("Payment already attempted; do not repeat it");
		quote.attempted = true;
		this.attempted.add(key);
		let txid: string | undefined;
		let fee: number | undefined;
		let submitted = false;
		let walletReturned = false;
		let created = false;
		const build = async (args: CreateActionArgs, expectedScript: string) => {
			if (created)
				throw new Error("Refusing to create a second payment transaction");
			created = true;
			const action = await wallet.createAction({
				...args,
				description: "Payment for HTTP service",
				labels: [`x402:${key}`],
				options: {
					...args.options,
					noSend: true,
					signAndProcess: true,
					returnTXIDOnly: false,
				},
			});
			walletReturned = true;
			if (!action.tx)
				throw new Error("Wallet did not return a signed transaction");
			const tx = Transaction.fromAtomicBEEF(action.tx);
			txid = tx.id("hex");
			const paid = tx.outputs
				.filter(
					(o) =>
						o.lockingScript.toHex().toLowerCase() ===
						expectedScript.toLowerCase(),
				)
				.reduce((sum, o) => sum + (o.satoshis ?? 0), 0);
			fee = tx.getFee();
			if (
				paid !== terms.amount ||
				!Number.isSafeInteger(fee) ||
				fee < 0 ||
				paid + fee > maxTotalSats
			)
				throw new Error(
					"Payment differs from quote or exceeds total spending limit; not submitted",
				);
			this.checkExpiry(quote);
			return { action, tx };
		};
		try {
			const history = await wallet.listActions({
				labels: [`x402:${key}`],
				limit: 1,
			});
			if (history.totalActions > 0)
				throw new Error("Wallet history already contains this challenge");
			let response: Response;
			if (terms.kind === "brc105") {
				if (!quote.startAuth || !quote.authClient)
					throw new Error("Missing authenticated quote context");
				const { action } = await build(
					terms.action,
					terms.action.outputs?.[0]?.lockingScript ?? "",
				);
				const details = JSON.parse(
					terms.action.outputs?.[0]?.customInstructions ?? "{}",
				);
				const payment = JSON.stringify({
					derivationPrefix: details.derivationPrefix,
					derivationSuffix: details.derivationSuffix,
					transaction: Buffer.from(action.tx ?? []).toString("base64"),
				});
				quote.startAuth();
				submitted = true;
				response = await timed(
					quote.authClient.fetch(quote.request.url, {
						method: quote.request.method,
						body:
							quote.request.body ??
							(["GET", "HEAD"].includes(quote.request.method) ? undefined : ""),
						headers: { ...quote.request.headers, "x-bsv-payment": payment },
						retryCounter: 1,
						paymentRetryAttempts: 0,
					}),
				);
			} else {
				const args: CreateActionArgs = {
					description: "Payment for HTTP service",
					outputs: [
						{
							satoshis: terms.amount,
							lockingScript: terms.script,
							outputDescription: "Requested service payment",
						},
					],
				};
				if (terms.kind === "bound") {
					const nonce = terms.raw.nonce_utxo;
					if (!this.config.getBeef)
						throw new Error(
							"Configure a transaction service to obtain the server nonce proof",
						);
					const beef = await this.config.getBeef(nonce.txid);
					const source = Transaction.fromBEEF(beef, nonce.txid);
					const output = source.outputs[nonce.vout];
					if (
						source.id("hex") !== nonce.txid ||
						output?.satoshis !== nonce.satoshis ||
						output.lockingScript.toHex() !== "51"
					)
						throw new Error(
							"Nonce transaction does not match the service challenge",
						);
					args.inputBEEF = [...beef];
					args.inputs = [
						{
							outpoint: `${nonce.txid}.${nonce.vout}`,
							unlockingScript: "",
							inputDescription: "Service payment nonce",
						},
					];
				}
				const { tx } = await build(args, terms.script);
				if (
					terms.kind === "bound" &&
					!tx.inputs.some(
						(i) =>
							(i.sourceTXID ?? i.sourceTransaction?.id("hex")) ===
								terms.raw.nonce_utxo.txid &&
							i.sourceOutputIndex === terms.raw.nonce_utxo.vout,
					)
				)
					throw new Error("Wallet omitted the required service nonce");
				const proof =
					terms.kind === "compact"
						? {
								version: "bsv-tx-v1",
								challenge_id: terms.id,
								rawtx_base64: Buffer.from(tx.toBinary()).toString("base64"),
								txid,
							}
						: {
								v: 1,
								scheme: "bsv-tx-v1",
								challenge_sha256: terms.id,
								request: {
									method: terms.raw.method,
									path: terms.raw.path,
									query: terms.raw.query,
									req_headers_sha256: terms.raw.req_headers_sha256,
									req_body_sha256: terms.raw.req_body_sha256,
								},
								payment: {
									txid,
									rawtx_b64: Buffer.from(tx.toBinary()).toString("base64"),
								},
							};
				submitted = true;
				response = await this.fetcher(terms.payUrl, {
					method: quote.request.method,
					body: quote.request.body,
					headers: {
						...quote.request.headers,
						"X402-Proof": Buffer.from(canonical(proof)).toString("base64url"),
					},
				});
			}
			if (!response.ok) {
				await response.body?.cancel();
				throw new Error(
					`Paid request returned HTTP ${response.status}; payment may have been accepted`,
				);
			}
			if (!created)
				return { status: "response", ...(await resultBody(response)) };
			return {
				status: "paid_response",
				paymentTxid: txid,
				amountSats: terms.amount,
				miningFeeSats: fee,
				totalSats: terms.amount + (fee ?? 0),
				...(await resultBody(response, quote.authContentType?.())),
			};
		} catch (error) {
			this.blocked = true;
			return {
				status:
					walletReturned && !submitted ? "not_submitted" : "outcome_unknown",
				paymentTxid: txid,
				quoteId,
				error:
					error instanceof QuoteCaptured
						? "The service still requires payment. No second payment was created; check the first payment outcome."
						: error instanceof Error
							? error.message
							: "Payment failed",
				nextStep: submitted
					? "Check wallet history and the service. Do not pay again or release inputs until the outcome is known."
					: "Review wallet history before retrying; funds may be reserved. This session will not create another payment.",
			};
		} finally {
			quote.stopAuth?.();
		}
	}
}

async function timed<T>(work: Promise<T>): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			work,
			new Promise<never>((_, reject) => {
				timer = setTimeout(
					() =>
						reject(
							new Error(
								"Authenticated request timed out; do not repeat a payment without checking its outcome",
							),
						),
					30000,
				);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}
