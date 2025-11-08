import { BSM, type PrivateKey } from "@bsv/sdk";

export interface DropletConfig {
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

export class DropletClient {
	constructor(private config: DropletConfig) {}

	getConfig(): DropletConfig {
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
		method: string,
		path: string,
		body: unknown,
	): Promise<Record<string, string>> {
		if (!this.config.authKey) {
			return {};
		}

		// Generate timestamp
		const timestamp = Math.floor(Date.now() / 1000).toString();

		// Create the message to sign (BSM format)
		// Format: requestPath + timestamp + body
		const bodyStr = JSON.stringify(body);
		const message = `${path}${timestamp}${bodyStr}`;

		// Sign the message using BSM
		const signature = BSM.sign(
			Buffer.from(message, "utf8"),
			this.config.authKey,
		);

		// Create the auth token in the format expected by go-bitcoin-auth
		// Format: "BSM <pubkey> <signature> <timestamp> <path>"
		const pubkey = this.config.authKey.toPublicKey().toString();
		const authToken = `BSM ${pubkey} ${signature.toString("base64")} ${timestamp} ${path}`;

		return {
			"X-Auth-Token": authToken,
		};
	}
}
