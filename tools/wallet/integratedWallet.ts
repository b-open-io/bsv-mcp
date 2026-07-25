import { type PrivateKey, Utils } from "@bsv/sdk";
import { DroplitClient, type DroplitConfig } from "../../utils/droplit";
import {
	buildAndSendTransaction,
	buildOpReturnScript,
} from "../utils/transactionBuilder";
import { Wallet } from "./wallet";

export interface IntegratedWalletConfig {
	// Local wallet config
	paymentKey?: PrivateKey;
	identityKey?: PrivateKey;

	// Droplit API config
	useDroplitApi?: boolean;
	droplitConfig?: DroplitConfig;
}

/**
 * Integrated wallet that can use either local keys or Droplit API
 */
export class IntegratedWallet {
	private localWallet?: Wallet;
	private droplitClient?: DroplitClient;

	constructor(config: IntegratedWalletConfig) {
		if (config.useDroplitApi && config.droplitConfig) {
			// If we have a payment key, use it for auth with Droplit API
			if (config.paymentKey) {
				config.droplitConfig.authKey = config.paymentKey;
			}
			this.droplitClient = new DroplitClient(config.droplitConfig);
			console.error("IntegratedWallet: Using Droplit API mode");
		} else if (config.paymentKey) {
			this.localWallet = new Wallet(config.paymentKey, config.identityKey);
			console.error("IntegratedWallet: Using local wallet mode");
		} else {
			console.error(
				"IntegratedWallet: No wallet configured (limited functionality)",
			);
		}
	}

	get isDroplitMode(): boolean {
		return !!this.droplitClient;
	}

	get hasWallet(): boolean {
		return !!this.localWallet || !!this.droplitClient;
	}

	async getBalance(): Promise<number> {
		if (this.droplitClient) {
			const status = await this.droplitClient.getFaucetStatus();
			return status.balance_satoshis;
		}
		if (this.localWallet) {
			const { paymentUtxos } = await this.localWallet.getUtxos();
			return paymentUtxos.reduce((sum, utxo) => sum + utxo.satoshis, 0);
		}
		throw new Error("No wallet configured");
	}

	async sendToAddress(
		address: string,
		satoshis: number,
	): Promise<{ txid: string }> {
		if (this.droplitClient) {
			// For Droplit API, we use the tap endpoint which sends the faucet's fixed amount
			// Note: Droplit API doesn't support custom amounts, it uses fixed_drop_sats
			const response = await this.droplitClient.tap(address);
			return { txid: response.txid };
		}
		if (this.localWallet) {
			return await this.localWallet.sendToAddress(address, satoshis);
		}
		throw new Error("No wallet configured");
	}

	async pushData(data: string[], encoding = "hex"): Promise<{ txid: string }> {
		if (this.droplitClient) {
			const response = await this.droplitClient.push(data, encoding);
			return { txid: response.txid };
		}
		if (this.localWallet) {
			const paymentKey = this.localWallet.getPaymentKey();
			const changeAddress = this.localWallet.getAddress();
			if (!paymentKey || !changeAddress) {
				throw new Error("Local wallet has no payment key");
			}
			if (encoding !== "hex" && encoding !== "utf8" && encoding !== "base64") {
				throw new Error(
					`Unsupported push data encoding "${encoding}"; expected hex, utf8 or base64`,
				);
			}
			const script = buildOpReturnScript(
				data.map((item) => Utils.toArray(item, encoding)),
			);
			const { paymentUtxos } = await this.localWallet.getUtxos();
			const result = await buildAndSendTransaction({
				outputs: [{ script, satoshis: 0 }],
				utxos: paymentUtxos,
				changeAddress,
				paymentKey,
			});
			if (!result.success || !result.txid) {
				throw new Error(result.error ?? "Failed to broadcast OP_RETURN data");
			}
			return { txid: result.txid };
		}
		throw new Error("No wallet configured");
	}

	// Delegate other methods to the appropriate implementation
	getLocalWallet(): Wallet | undefined {
		return this.localWallet;
	}

	getDroplitClient(): DroplitClient | undefined {
		return this.droplitClient;
	}
}
