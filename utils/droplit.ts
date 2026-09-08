import {
	AuthFetch,
	type PrivateKey,
	ProtoWallet,
	type WalletInterface,
} from "@bsv/sdk";
import { z } from "zod";

/**
 * Client for the Droplit faucet API (droplit-server, api.droplit.dev).
 *
 * Protected routes sit behind BRC-103/104 mutual authentication via
 * go-bsv-middleware, which is a handshake rather than a bearer credential. A
 * single signed token cannot satisfy it: a correctly formatted bitcoin-auth
 * token returns 401 on /auth/status while AuthFetch against that same endpoint
 * returns 200 and an identity. Both were checked against the live service.
 *
 * bitcoin-auth/BRC-77 does still appear server-side, but only for the SSE
 * stream endpoints, which cannot run through the mutual-auth middleware
 * because it buffers and signs the entire response body.
 */

export interface DroplitConfig {
	/** Human approval site origin; defaults to https://droplit.dev. */
	siteUrl?: string;
	apiUrl: string;
	faucetName: string;
	/** Identity for the BRC-103/104 handshake. Unauthenticated without it. */
	authKey?: PrivateKey;
	/** Connected signer; mutually exclusive with authKey. */
	wallet?: WalletInterface;
}

export interface FaucetAccess {
	slug: string;
	public_key: string;
	authorized: boolean;
	is_owner: boolean;
	quotas: Array<Record<string, unknown>>;
	unrestricted_kinds: string[];
	approval_path: string;
	approval_url: string;
}

export function readDroplitSponsorConfig(
	env: Record<string, string | undefined> = process.env,
): Pick<DroplitConfig, "apiUrl" | "faucetName" | "siteUrl"> | undefined {
	const apiUrl = env.DROPLIT_API_URL;
	const faucetName = env.DROPLIT_FAUCET_NAME;
	const siteUrl = env.DROPLIT_SITE_URL;
	if (apiUrl === undefined && faucetName === undefined && siteUrl === undefined)
		return undefined;
	if (apiUrl?.trim() && faucetName === undefined) {
		droplitApiBaseUrl(apiUrl);
		if (siteUrl !== undefined) approvalSiteOrigin(siteUrl);
		return undefined; // API-only configuration enables unsigned discovery.
	}
	if (!apiUrl?.trim() || !faucetName?.trim()) {
		throw new Error(
			"DROPLIT_API_URL and DROPLIT_FAUCET_NAME must both be explicitly configured",
		);
	}
	return {
		apiUrl,
		faucetName,
		...(siteUrl === undefined ? {} : { siteUrl: approvalSiteOrigin(siteUrl) }),
	};
}

export function droplitApiBaseUrl(apiUrl: string): string {
	const url = new URL(apiUrl);
	const loopback =
		url.hostname === "localhost" ||
		url.hostname === "127.0.0.1" ||
		url.hostname === "[::1]";
	if (
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		!(url.protocol === "https:" || (url.protocol === "http:" && loopback))
	) {
		throw new Error(
			"Droplit API requires HTTPS or HTTP loopback without credentials, query or fragment",
		);
	}
	return url.href.replace(/\/$/, "");
}

function approvalSiteOrigin(value = "https://droplit.dev"): string {
	const url = new URL(value);
	const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
	if (
		url.username ||
		url.password ||
		url.pathname !== "/" ||
		url.href.includes("?") ||
		url.href.includes("#") ||
		value.includes("\\") ||
		!(url.protocol === "https:" || (url.protocol === "http:" && loopback))
	) {
		throw new Error(
			"DROPLIT_SITE_URL requires an HTTPS or HTTP loopback origin without credentials, path, query or fragment",
		);
	}
	return url.origin;
}

export class DroplitError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly status?: number,
		readonly details: Record<string, unknown> = {},
	) {
		super(message);
	}
}

function quotaDetails(body: unknown): Record<string, unknown> {
	if (!body || typeof body !== "object") return {};
	const value = body as Record<string, unknown>;
	return {
		...(typeof value.remaining === "number" || value.remaining === null
			? { remaining: value.remaining }
			: {}),
		...(typeof value.resets_at === "string"
			? { resets_at: value.resets_at }
			: {}),
	};
}

function httpFailure(
	status: number,
	details: Record<string, unknown> = {},
): DroplitError {
	const known: Record<number, [string, string]> = {
		401: [
			"authentication_required",
			"Authenticate with the configured wallet before retrying.",
		],
		402: [
			"approval_required",
			"Payment is required. No automatic payment was made; review payment with the wallet owner.",
		],
		403: [
			"approval_required",
			"The sponsor has not authorized this action. Ask its owner to approve your wallet.",
		],
		429: [
			"quota_exceeded",
			"Sponsor quota exhausted. Wait until resets_at or ask the owner to adjust your quota.",
		],
	};
	const [code, message] = known[status] ?? [
		"http_error",
		"Droplit rejected the request. Check sponsor access and transaction history before retrying.",
	];
	return new DroplitError(code, message, status, details);
}

export interface FaucetStatus {
	faucet_name: string;
	balance_satoshis: number;
	unspent_utxo_count: number;
	fixed_drop_sats: number;
	spendable_utxo_count: number;
	consolidating_balance_satoshis: number;
	consolidating_utxo_count: number;
}

export interface TapResponse {
	txid: string;
}

export interface PushResponse {
	txid: string;
	message: string;
}

export class DroplitClient {
	/**
	 * Built once and reused. AuthFetch holds the negotiated peer session, so a
	 * fresh instance per call would repeat the handshake every request.
	 */
	private readonly authFetch?: AuthFetch;
	private readonly siteOrigin: string;
	private readonly wallet?: WalletInterface | ProtoWallet;

	constructor(private config: DroplitConfig) {
		this.siteOrigin = approvalSiteOrigin(config.siteUrl);
		if (config.wallet && config.authKey)
			throw new Error("Configure Droplit wallet or authKey, not both");
		droplitApiBaseUrl(config.apiUrl);
		if (!config.faucetName.trim())
			throw new Error("Droplit faucet name is required");
		this.wallet =
			config.wallet ??
			(config.authKey ? new ProtoWallet(config.authKey) : undefined);
		if (this.wallet) {
			const authenticationWallet = new Proxy(this.wallet as WalletInterface, {
				get(target, property) {
					// SDK BRC-105 can create a payment even with paymentRetryAttempts: 0.
					// Authentication may sign challenges, but it must never spend funds.
					if (property === "createAction" || property === "signAction") {
						return async () => {
							throw httpFailure(402);
						};
					}
					const value = Reflect.get(target, property, target);
					return typeof value === "function" ? value.bind(target) : value;
				},
			});
			this.authFetch = new AuthFetch(authenticationWallet);
		}
	}

	getConfig(): Pick<DroplitConfig, "apiUrl" | "faucetName"> {
		return { apiUrl: this.config.apiUrl, faucetName: this.config.faucetName };
	}

	async getIdentityKey(): Promise<string> {
		if (!this.wallet)
			throw new DroplitError(
				"authentication_required",
				"Configure a Droplit wallet identity.",
			);
		const { publicKey } = await this.wallet.getPublicKey({ identityKey: true });
		return publicKey;
	}

	private get faucetPath(): string {
		return `/faucet/${encodeURIComponent(this.config.faucetName)}`;
	}

	private get base(): string {
		return this.config.apiUrl.replace(/\/+$/, "");
	}

	/**
	 * Authenticated request. Without an identity this throws rather than sending
	 * an anonymous request the server rejects anyway — that 401 would arrive
	 * with nothing to say the real cause was missing configuration.
	 */
	private async authed(
		path: string,
		init: { method: string; body?: unknown },
	): Promise<Response> {
		if (!this.authFetch) {
			throw new Error(
				`${path} requires authentication and no Droplit auth key is configured.`,
			);
		}

		try {
			return await this.authFetch.fetch(`${this.base}${path}`, {
				method: init.method,
				headers: { "Content-Type": "application/json" },
				...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
				paymentRetryAttempts: 0,
				// One SDK submission: do not replay an ambiguous write on session failure.
				...(init.method === "GET" || init.method === "HEAD"
					? {}
					: { retryCounter: 1 }),
			});
		} catch (error) {
			if (error instanceof DroplitError) throw error;
			// The SDK may reject an HTTP error without auth headers rather than return
			// a Response. Preserve its status, but never expose its request/body preview.
			const details = (
				error as {
					details?: { status?: unknown; bodyPreview?: unknown };
				} | null
			)?.details;
			const status = details?.status;
			if (typeof status === "number" && [401, 402, 403, 429].includes(status)) {
				let body: unknown;
				if (status === 429 && typeof details?.bodyPreview === "string") {
					try {
						body = JSON.parse(details.bodyPreview);
					} catch {
						/* Truncated SDK previews are not a quota record. */
					}
				}
				throw httpFailure(status, status === 429 ? quotaDetails(body) : {});
			}
			const write = init.method !== "GET" && init.method !== "HEAD";
			throw new DroplitError(
				write ? "unknown_outcome" : "request_failed",
				write
					? "Request outcome is unknown. Reconcile transaction/history before retrying; no automatic retry was made."
					: "Authenticated request failed. Check the signer and sponsor connection.",
			);
		}
	}

	private async parse<T>(response: Response, _attempted: string): Promise<T> {
		if (response.ok) {
			try {
				return (await response.json()) as T;
			} catch {
				throw new DroplitError(
					"unknown_outcome",
					"Response could not be read. Reconcile transaction/history before retrying.",
					response.status,
				);
			}
		}
		let body: unknown = {};
		try {
			body = await response.json();
		} catch {
			/* Status is sufficient; never echo raw request/proxy output. */
		}
		throw httpFailure(
			response.status,
			response.status === 429 ? quotaDetails(body) : {},
		);
	}

	async getAccess(): Promise<FaucetAccess> {
		const response = await this.authed(`${this.faucetPath}/access`, {
			method: "GET",
		});
		const access = await this.parse<FaucetAccess>(
			response,
			"Reading sponsor access",
		);
		const identity = await this.getIdentityKey();
		if (
			!access ||
			access.public_key !== identity ||
			access.slug !== this.config.faucetName ||
			typeof access.authorized !== "boolean" ||
			typeof access.is_owner !== "boolean" ||
			!Array.isArray(access.quotas) ||
			!Array.isArray(access.unrestricted_kinds)
		) {
			throw new DroplitError(
				"invalid_response",
				"Sponsor access response did not match the authenticated wallet.",
			);
		}
		// Build the convenience path from our configuration and signer identity,
		// never from an arbitrary server-supplied redirect.
		access.approval_path = `/droplit/${encodeURIComponent(this.config.faucetName)}?tab=api&request_key=${encodeURIComponent(identity)}`;
		access.approval_url = new URL(access.approval_path, this.siteOrigin).href;
		return access;
	}

	async fund(rawtx: string): Promise<{ txid: string; rawtx?: string }> {
		const response = await this.authed(`${this.faucetPath}/fund`, {
			method: "POST",
			body: { rawtx },
		});
		return this.parse(response, "Funding transaction");
	}

	/** Public route: no handshake, so this works without an auth key. */
	async getFaucetStatus(): Promise<FaucetStatus> {
		const response = await fetch(`${this.base}${this.faucetPath}/status`);
		return this.parse<FaucetStatus>(response, "Reading the faucet status");
	}

	async tap(recipientAddress: string, satoshis?: number): Promise<TapResponse> {
		if (
			satoshis !== undefined &&
			(!Number.isSafeInteger(satoshis) || satoshis <= 0)
		)
			throw new Error("satoshis must be a positive safe integer");
		const response = await this.authed(`${this.faucetPath}/tap`, {
			method: "POST",
			body: {
				recipient_address: recipientAddress,
				...(satoshis === undefined ? {} : { satoshis }),
			},
		});
		return this.parse<TapResponse>(response, "Tapping the faucet");
	}

	async push(data: string[], encoding = "hex"): Promise<PushResponse> {
		const response = await this.authed(`${this.faucetPath}/push`, {
			method: "POST",
			body: { data, encoding },
		});
		return this.parse<PushResponse>(response, "Pushing data");
	}

	/**
	 * For callers that need a route the typed methods above do not cover.
	 * Returns the raw Response.
	 */
	async authenticatedFetch(
		path: string,
		init: { method: string; body?: unknown },
	): Promise<Response> {
		return this.authed(path, init);
	}
}

const publicSponsorsSchema = z.object({
	sponsors: z
		.array(
			z.object({
				name: z.string(),
				slug: z.string().min(1),
				approval_required: z.literal(true),
			}),
		)
		.max(50),
	next_cursor: z.string().min(1).nullable(),
});

/** Public catalog only: never constructs AuthFetch or touches a wallet. */
export async function discoverDroplitSponsors(
	apiUrl: string,
	options: { limit?: number; after?: string } = {},
) {
	const limit = options.limit ?? 20;
	if (!Number.isInteger(limit) || limit < 1 || limit > 50)
		throw new Error("limit must be an integer from 1 to 50");
	const url = new URL(`${droplitApiBaseUrl(apiUrl)}/sponsors`);
	url.searchParams.set("limit", String(limit));
	if (options.after !== undefined) url.searchParams.set("after", options.after);
	let response: Response;
	try {
		response = await fetch(url, {
			method: "GET",
			redirect: "error",
			credentials: "omit",
			signal: AbortSignal.timeout(15000),
		});
	} catch {
		throw new DroplitError(
			"request_failed",
			"Could not read public sponsors. Check the configured API origin.",
		);
	}
	if (!response.ok)
		throw new DroplitError(
			"request_failed",
			"Could not read public sponsors.",
			response.status,
		);
	try {
		return publicSponsorsSchema.parse(await response.json());
	} catch {
		throw new DroplitError(
			"invalid_response",
			"Public sponsor response was invalid.",
		);
	}
}
