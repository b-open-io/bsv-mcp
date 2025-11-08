import { P2PKH, type PrivateKey, Script } from "@bsv/sdk";
import { DropletClient, type DropletConfig } from "../../utils/droplet";
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
			return this.localWallet.getTotalBalance();
		}
		throw new Error("No wallet configured");
	}

	async sendToAddress(
		address: string,
		satoshis: number,
		description?: string,
	): Promise<{ txid: string }> {
		if (this.dropletClient) {
			// For Droplet API, we use the tap endpoint which sends the faucet's fixed amount
			// Note: Droplet API doesn't support custom amounts, it uses fixed_drop_sats
			const response = await this.dropletClient.tap(address);
			return { txid: response.txid };
		}
		if (this.localWallet) {
			const tx = await this.localWallet.createAction({
				description: description || "Send to address",
				outputs: [
					{
						lockingScript: new P2PKH().lock(address).toHex(),
						satoshis,
						outputDescription: `Payment to ${address}`,
					},
				],
			});
			return { txid: tx.txid };
		}
		throw new Error("No wallet configured");
	}

	async pushData(data: string[], encoding = "hex"): Promise<{ txid: string }> {
		if (this.dropletClient) {
			const response = await this.dropletClient.push(data, encoding);
			return { txid: response.txid };
		}
		if (this.localWallet) {
			// For local wallet, we need to implement OP_RETURN transaction
			// This is a simplified version - you might want to enhance this
			const opReturnScript = Script.fromASM(
				`OP_FALSE OP_RETURN ${data.join(" ")}`,
			);
			const tx = await this.localWallet.createAction({
				description: "Push data",
				outputs: [
					{
						lockingScript: opReturnScript.toHex(),
						satoshis: 0,
						outputDescription: "OP_RETURN data",
					},
				],
			});
			return { txid: tx.txid };
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
