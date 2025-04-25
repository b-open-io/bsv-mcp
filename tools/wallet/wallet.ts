/**
 * Wallet implementation scaffold.
 *
 * Implements WalletInterface from the ts-sdk and extends ProtoWallet.
 *
 * See: https://github.com/bitcoin-sv/ts-sdk/blob/main/src/wallet/Wallet.interfaces.ts
 */
import { LockingScript, PrivateKey, ProtoWallet, Transaction } from "@bsv/sdk";
import type {
	AbortActionArgs,
	AbortActionResult,
	AcquireCertificateArgs,
	AuthenticatedResult,
	CreateActionArgs,
	CreateActionResult,
	DiscoverByAttributesArgs,
	DiscoverByIdentityKeyArgs,
	DiscoverCertificatesResult,
	GetHeaderArgs,
	GetHeaderResult,
	GetHeightResult,
	GetNetworkResult,
	GetPublicKeyArgs,
	GetPublicKeyResult,
	GetVersionResult,
	InternalizeActionArgs,
	InternalizeActionResult,
	ListActionsArgs,
	ListActionsResult,
	ListCertificatesArgs,
	ListCertificatesResult,
	ListOutputsArgs,
	ListOutputsResult,
	ProveCertificateArgs,
	ProveCertificateResult,
	PubKeyHex,
	RelinquishCertificateArgs,
	RelinquishCertificateResult,
	RelinquishOutputArgs,
	RelinquishOutputResult,
	RevealCounterpartyKeyLinkageArgs,
	RevealCounterpartyKeyLinkageResult,
	RevealSpecificKeyLinkageArgs,
	RevealSpecificKeyLinkageResult,
	SignActionArgs,
	SignActionResult,
	WalletCertificate,
	WalletInterface,
} from "@bsv/sdk";
import { type NftUtxo, type Utxo, fetchNftUtxos } from "js-1sat-ord";
import { fetchPaymentUtxos } from "./fetchPaymentUtxos";

export class Wallet extends ProtoWallet implements WalletInterface {
	private paymentUtxos: Utxo[] = [];
	private nftUtxos: NftUtxo[] = [];
	private lastUtxoFetch = 0;
	private readonly utxoRefreshIntervalMs = 5 * 60 * 1000; // 5 minutes
	private privateKey?: PrivateKey;

	constructor(privKey?: PrivateKey) {
		super(privKey);
		this.privateKey = privKey;
		// Initialize UTXOs
		this.refreshUtxos().catch((err) =>
			console.error("Error initializing UTXOs:", err),
		);
	}

	/**
	 * Refresh UTXOs from the network
	 */
	async refreshUtxos(): Promise<void> {
		try {
			const privateKey = this.getPrivateKey();
			if (!privateKey) {
				return; // Silent fail if no private key, keep existing UTXOs
			}

			const address = privateKey.toAddress().toString();
			this.lastUtxoFetch = Date.now();

			// Payment UTXOs
			let newPaymentUtxos: Utxo[] | undefined = undefined;
			try {
				newPaymentUtxos = await fetchPaymentUtxos(address);
				// Only update if we successfully got UTXOs
				if (Array.isArray(newPaymentUtxos)) {
					this.paymentUtxos = newPaymentUtxos;
				}
			} catch (error) {
				// Keep existing UTXOs, don't clear them on error
			}

			// NFT UTXOs - keep existing if fetch fails
			let newNftUtxos: NftUtxo[] = [];
			try {
				newNftUtxos = await fetchNftUtxos(address);
				// Only update if we successfully got UTXOs
				if (Array.isArray(newNftUtxos)) {
					this.nftUtxos = newNftUtxos;
				}
			} catch (error) {
				// Keep existing UTXOs, don't clear them on error
			}
		} catch (error) {
			// Silent global error, preserve existing UTXOs
		}
	}

	/**
	 * Get payment and NFT UTXOs, refreshing if needed
	 */
	async getUtxos(): Promise<{ paymentUtxos: Utxo[]; nftUtxos: NftUtxo[] }> {
		const now = Date.now();
		if (now - this.lastUtxoFetch > this.utxoRefreshIntervalMs) {
			await this.refreshUtxos();
		}
		return { paymentUtxos: this.paymentUtxos, nftUtxos: this.nftUtxos };
	}

	/**
	 * Get the private key if available
	 */
	getPrivateKey(): PrivateKey | undefined {
		// Try to get private key from environment if not already set
		if (!this.privateKey) {
			const wif = process.env.PRIVATE_KEY_WIF;
			if (wif) {
				this.privateKey = PrivateKey.fromWif(wif);
			}
		}
		return this.privateKey;
	}

	async getPublicKey(args: GetPublicKeyArgs): Promise<GetPublicKeyResult> {
		const privateKey = this.getPrivateKey();
		if (!privateKey) {
			throw new Error("No private key available");
		}

		const publicKey = privateKey.toPublicKey();
		return {
			publicKey: publicKey.toDER("hex") as PubKeyHex,
		};
	}
	async revealCounterpartyKeyLinkage(
		args: RevealCounterpartyKeyLinkageArgs,
	): Promise<RevealCounterpartyKeyLinkageResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async revealSpecificKeyLinkage(
		args: RevealSpecificKeyLinkageArgs,
	): Promise<RevealSpecificKeyLinkageResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	// Implemented by ProtoWallet
	// async encrypt(args: WalletEncryptArgs): Promise<WalletEncryptResult> {
	// 	return this.encrypt(args);
	// }
	// async decrypt(args: WalletDecryptArgs): Promise<WalletDecryptResult> {
	// 	return this.decrypt(args);
	// }
	// async createHmac(args: CreateHmacArgs): Promise<CreateHmacResult> {
	// 	return this.createHmac(args);
	// }
	// async verifyHmac(args: VerifyHmacArgs): Promise<VerifyHmacResult> {
	// 	return this.verifyHmac(args);
	// }
	// async createSignature(
	// 	args: CreateSignatureArgs,
	// ): Promise<CreateSignatureResult> {
	// 	return Promise.reject(new Error("Not implemented"));
	// }
	// async verifySignature(
	// 	args: VerifySignatureArgs,
	// ): Promise<VerifySignatureResult> {
	// 	return Promise.reject(new Error("Not implemented"));
	// }
	async createAction(args: CreateActionArgs): Promise<CreateActionResult> {
		const tx = new Transaction();

		// Add outputs
		if (args.outputs) {
			for (const output of args.outputs) {
				const lockingScript = LockingScript.fromHex(output.lockingScript);
				tx.addOutput({
					lockingScript,
					satoshis: output.satoshis,
				});
			}
		}

		// Add inputs (if provided)
		if (args.inputs) {
			for (const input of args.inputs) {
				const [txid, outputIndexStr] = input.outpoint.split(".");
				tx.addInput({
					sourceTXID: txid,
					sourceOutputIndex: Number.parseInt(outputIndexStr || "0", 10),
				});
			}
		}

		// Set lockTime and version if provided
		if (args.lockTime !== undefined) tx.lockTime = args.lockTime;
		if (args.version !== undefined) tx.version = args.version;

		// Serialize the transaction using Utils
		const txid = tx.hash("hex") as string;
		const txArray = tx.toBinary();

		return {
			txid,
			tx: txArray,
			signableTransaction: undefined,
		};
	}
	async signAction(args: SignActionArgs): Promise<SignActionResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async abortAction(args: AbortActionArgs): Promise<AbortActionResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async listActions(args: ListActionsArgs): Promise<ListActionsResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async internalizeAction(
		args: InternalizeActionArgs,
	): Promise<InternalizeActionResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async listOutputs(args: ListOutputsArgs): Promise<ListOutputsResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async relinquishOutput(
		args: RelinquishOutputArgs,
	): Promise<RelinquishOutputResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async acquireCertificate(
		args: AcquireCertificateArgs,
	): Promise<WalletCertificate> {
		return Promise.reject(new Error("Not implemented"));
	}
	async listCertificates(
		args: ListCertificatesArgs,
	): Promise<ListCertificatesResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async proveCertificate(
		args: ProveCertificateArgs,
	): Promise<ProveCertificateResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async relinquishCertificate(
		args: RelinquishCertificateArgs,
	): Promise<RelinquishCertificateResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async discoverByIdentityKey(
		args: DiscoverByIdentityKeyArgs,
	): Promise<DiscoverCertificatesResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async discoverByAttributes(
		args: DiscoverByAttributesArgs,
	): Promise<DiscoverCertificatesResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async isAuthenticated(args: object): Promise<AuthenticatedResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async waitForAuthentication(args: object): Promise<AuthenticatedResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async getHeight(args: object): Promise<GetHeightResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async getHeaderForHeight(args: GetHeaderArgs): Promise<GetHeaderResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async getNetwork(args: object): Promise<GetNetworkResult> {
		return Promise.reject(new Error("Not implemented"));
	}
	async getVersion(args: object): Promise<GetVersionResult> {
		return Promise.reject(new Error("Not implemented"));
	}
}

export default Wallet;
