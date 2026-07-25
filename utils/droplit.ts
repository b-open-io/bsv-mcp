import type { PrivateKey } from "@bsv/sdk";
import { getAuthToken } from "bitcoin-auth";

export interface DroplitConfig {
	apiUrl: string;
	faucetName: string;
	authKey?: PrivateKey; // Optional auth key for API authentication
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
	constructor(private config: DroplitConfig) {}

	getConfig(): DroplitConfig {
		return this.config;
	}

	async getFaucetStatus(): Promise<FaucetStatus> {
		const response = await fetch(
			`${this.config.apiUrl}/faucet/${this.config.faucetName}/status`,
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to get faucet status");
		}

		return response.json();
	}

	async tap(recipientAddress: string): Promise<TapResponse> {
		const response = await fetch(
			`${this.config.apiUrl}/faucet/${this.config.faucetName}/tap`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(this.config.authKey
						? await this.getAuthHeaders(
								"POST",
								`/faucet/${this.config.faucetName}/tap`,
								{ recipient_address: recipientAddress },
							)
						: {}),
				},
				body: JSON.stringify({ recipient_address: recipientAddress }),
			},
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to tap faucet");
		}

		return response.json();
	}

	async push(data: string[], encoding = "hex"): Promise<PushResponse> {
		const response = await fetch(
			`${this.config.apiUrl}/faucet/${this.config.faucetName}/push`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(this.config.authKey
						? await this.getAuthHeaders(
								"POST",
								`/faucet/${this.config.faucetName}/push`,
								{ data, encoding },
							)
						: {}),
				},
				body: JSON.stringify({ data, encoding }),
			},
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to push data");
		}

		return response.json();
	}

	async getAuthHeaders(
		_method: string,
		path: string,
		body: unknown,
	): Promise<Record<string, string>> {
		if (!this.config.authKey) {
			return {};
		}

		// bitcoin-auth owns this format and go-bitcoin-auth verifies it on the
		// server. Hand-rolling it here produced a token the server could never
		// accept: space-separated with a "BSM " prefix instead of the
		// pubkey|scheme|timestamp|path|signature form, signing a raw
		// concatenation rather than path|timestamp|bodyHash, and stamping Unix
		// seconds where an ISO8601 timestamp is expected.
		return {
			"X-Auth-Token": getAuthToken({
				privateKeyWif: this.config.authKey.toWif(),
				requestPath: path,
				body: JSON.stringify(body),
			}),
		};
	}
}
