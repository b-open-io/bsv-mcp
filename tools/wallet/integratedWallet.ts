import { type PrivateKey, Utils } from "@bsv/sdk";
import { DropletClient, type DropletConfig } from "../../utils/droplet";
import {
	buildAndSendTransaction,
	buildOpReturnScript,
} from "../utils/transactionBuilder";
import { Wallet } from "./wallet";

export interface IntegratedWalletConfig {
	// Local wallet config
	paymentKey?: PrivateKey;
	identityKey?: PrivateKey;

	// Droplet API config
	useDropletApi?: boolean;
	dropletConfig?: DropletConfig;
}

/**
 * Integrated wallet that can use either local keys or Droplet API
 */
export class IntegratedWallet {
	private localWallet?: Wallet;
	private dropletClient?: DropletClient;

	constructor(private config: IntegratedWalletConfig) {
		if (config.useDropletApi && config.dropletConfig) {
			// If we have a payment key, use it for auth with Droplet API
			if (config.paymentKey) {
				config.dropletConfig.authKey = config.paymentKey;
			}
			this.dropletClient = new DropletClient(config.dropletConfig);
			console.error("IntegratedWallet: Using Droplet API mode");
		} else if (config.paymentKey) {
			this.localWallet = new Wallet(config.paymentKey, config.identityKey);
			console.error("IntegratedWallet: Using local wallet mode");
		} else {
			console.error(
				"IntegratedWallet: No wallet configured (limited functionality)",
			);
		}
	}

	get isDropletMode(): boolean {
		return !!this.dropletClient;
	}

	get hasWallet(): boolean {
		return !!this.localWallet || !!this.dropletClient;
	}

	async getBalance(): Promise<number> {
		if (this.dropletClient) {
			const status = await this.dropletClient.getFaucetStatus();
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
		if (this.dropletClient) {
			// For Droplet API, we use the tap endpoint which sends the faucet's fixed amount
			// Note: Droplet API doesn't support custom amounts, it uses fixed_drop_sats
			const response = await this.dropletClient.tap(address);
			return { txid: response.txid };
		}
		if (this.localWallet) {
			return await this.localWallet.sendToAddress(address, satoshis);
		}
		throw new Error("No wallet configured");
	}

	async pushData(data: string[], encoding = "hex"): Promise<{ txid: string }> {
		if (this.dropletClient) {
			const response = await this.dropletClient.push(data, encoding);
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

	getDropletClient(): DropletClient | undefined {
		return this.dropletClient;
	}
}
