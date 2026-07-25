import { AuthFetch, type PrivateKey, ProtoWallet } from "@bsv/sdk";

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
	apiUrl: string;
	faucetName: string;
	/** Identity for the BRC-103/104 handshake. Unauthenticated without it. */
	authKey?: PrivateKey;
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

	constructor(private config: DroplitConfig) {
		if (config.authKey) {
			this.authFetch = new AuthFetch(new ProtoWallet(config.authKey) as never);
		}
	}

	getConfig(): DroplitConfig {
		return this.config;
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

		return this.authFetch.fetch(`${this.base}${path}`, {
			method: init.method,
			headers: { "Content-Type": "application/json" },
			...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
		});
	}

	private async parse<T>(response: Response, attempted: string): Promise<T> {
		if (response.ok) return (await response.json()) as T;

		// Errors come back as JSON, but a proxy or a plain 404 can answer with
		// HTML, and JSON.parse on that buries the real status under a syntax
		// error. Fall back to the raw text and always surface the status.
		const raw = await response.text();
		let detail = raw.slice(0, 200);
		try {
			const parsed = JSON.parse(raw) as { message?: string; error?: string };
			detail = parsed.message ?? parsed.error ?? detail;
		} catch {
			// Not JSON — keep the raw excerpt.
		}
		throw new Error(`${attempted} failed (${response.status}): ${detail}`);
	}

	/** Public route: no handshake, so this works without an auth key. */
	async getFaucetStatus(): Promise<FaucetStatus> {
		const response = await fetch(
			`${this.base}/faucet/${this.config.faucetName}/status`,
		);
		return this.parse<FaucetStatus>(response, "Reading the faucet status");
	}

	async tap(recipientAddress: string): Promise<TapResponse> {
		const response = await this.authed(
			`/faucet/${this.config.faucetName}/tap`,
			{ method: "POST", body: { recipient_address: recipientAddress } },
		);
		return this.parse<TapResponse>(response, "Tapping the faucet");
	}

	async push(data: string[], encoding = "hex"): Promise<PushResponse> {
		const response = await this.authed(
			`/faucet/${this.config.faucetName}/push`,
			{ method: "POST", body: { data, encoding } },
		);
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
