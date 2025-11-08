/**
 * Wallet implementation scaffold.
 *
 * Implements WalletInterface from the ts-sdk and extends ProtoWallet.
 *
 * See: https://github.com/bitcoin-sv/ts-sdk/blob/main/src/wallet/Wallet.interfaces.ts
 */
import {
	Beef,
	type BroadcastFailure,
	type BroadcastResponse,
	P2PKH,
	PrivateKey,
	type PublicKey,
	SatoshisPerKilobyte,
	Script,
	Transaction,
	Utils,
	fromUtxo,
	isBroadcastFailure,
	isBroadcastResponse,
} from "@bsv/sdk";
import type { GetPublicKeyArgs, GetPublicKeyResult, PubKeyHex } from "@bsv/sdk";
import { type NftUtxo, type Utxo, fetchNftUtxos } from "js-1sat-ord";
import { V5Broadcaster } from "../../utils/broadcaster";
import { fetchPaymentUtxosFromV5 } from "./fetchPaymentUtxos";

// Local interface for what encrypt/decrypt expect, will be mapped from Zod schema
interface InternalEncryptionArgs {
	data: Buffer;
	recipientPublicKey?: PublicKey; // For encryption
}

interface InternalDecryptionArgs {
	data: Buffer;
}

export class Wallet {
	private paymentUtxos: Utxo[] = [];
	private nftUtxos: NftUtxo[] = [];
	private lastUtxoFetch = 0;
	private readonly utxoRefreshIntervalMs = 5 * 60 * 1000; // 5 minutes
	private paymentKey?: PrivateKey;
	private identityKey?: PrivateKey;
	constructor(paymentKey?: PrivateKey, identityKey?: PrivateKey) {
		this.paymentKey = paymentKey;
		this.identityKey = identityKey;

		if (this.paymentKey) {
			this.refreshUtxos().catch((err) =>
				console.error("Error initializing UTXOs:", err),
			);
		}
	}

	async refreshUtxos(): Promise<void> {
		const currentPaymentKey = this.getPaymentKey();
		if (!currentPaymentKey) {
			console.error("Wallet: refreshUtxos called without a payment key.");
			return;
		}
		const address = currentPaymentKey.toAddress();
		this.lastUtxoFetch = Date.now();
		console.error(`Wallet: Refreshing UTXOs for address ${address}...`);

		try {
			const newPaymentUtxos = await fetchPaymentUtxosFromV5(address);
			if (Array.isArray(newPaymentUtxos)) {
				this.paymentUtxos = newPaymentUtxos;
				console.error(
					`Wallet: Fetched ${this.paymentUtxos.length} payment UTXOs.`,
				);
			} else {
				console.error(
					"Wallet: fetchPaymentUtxos did not return an array. Keeping existing payment UTXOs.",
				);
			}
		} catch (error) {
			console.error("Wallet: Error fetching payment UTXOs:", error);
			// Keep existing UTXOs on error
		}

		try {
			const newNftUtxos = await fetchNftUtxos(address);
			if (Array.isArray(newNftUtxos)) {
				this.nftUtxos = newNftUtxos;
				console.error(`Wallet: Fetched ${this.nftUtxos.length} NFT UTXOs.`);
			} else {
				console.error(
					"Wallet: fetchNftUtxos did not return an array. Keeping existing NFT UTXOs.",
				);
			}
		} catch (error) {
			console.error("Wallet: Error fetching NFT UTXOs:", error);
			// Keep existing UTXOs on error
		}
	}

	async getUtxos(): Promise<{ paymentUtxos: Utxo[]; nftUtxos: NftUtxo[] }> {
		const now = Date.now();
		if (!this.paymentKey) {
			// If there's no private key, UTXOs can't be fetched or belong to anyone.
			return { paymentUtxos: [], nftUtxos: [] };
		}
		if (now - this.lastUtxoFetch > this.utxoRefreshIntervalMs) {
			await this.refreshUtxos();
		}
		return { paymentUtxos: this.paymentUtxos, nftUtxos: this.nftUtxos };
	}

	getIdentityKey(): PrivateKey | undefined {
		if (this.identityKey) {
			return this.identityKey;
		}
		const wif = process.env.IDENTITY_KEY_WIF;
		if (wif) {
			try {
				this.identityKey = PrivateKey.fromWif(wif);
				return this.identityKey;
			} catch (e) {
				console.error(
					"Wallet: Invalid Identity Key WIF from environment variable.",
					e,
				);
			}
		}
		return undefined;
	}

	getPaymentKey(): PrivateKey | undefined {
		if (!this.paymentKey) {
			const wif = process.env.PRIVATE_KEY_WIF;
			if (wif) {
				try {
					this.paymentKey = PrivateKey.fromWif(wif);
				} catch (e) {
					console.error("Wallet: Invalid WIF from environment variable.", e);
				}
			}
		}
		return this.paymentKey;
	}

	getAddress(): string | undefined {
		return this.getPaymentKey()?.toAddress();
	}

	async getPublicKey(args?: GetPublicKeyArgs): Promise<GetPublicKeyResult> {
		const currentPaymentKey = this.getPaymentKey();
		if (!currentPaymentKey) {
			throw new Error("No payment key available to derive public key.");
		}
		const publicKey = currentPaymentKey.toPublicKey();
		return {
			publicKey: publicKey.toDER("hex") as PubKeyHex,
		};
	}

	// async encrypt(args: {
	// 	data: Buffer;
	// 	recipientPublicKeyHex: string;
	// }): Promise<Buffer> {
	// 	const senderPaymentKey = this.getPaymentKey();
	// 	if (!senderPaymentKey) {
	// 		throw new Error("Cannot encrypt: Wallet payment key is not available.");
	// 	}
	// 	if (!args.recipientPublicKeyHex) {
	// 		throw new Error(
	// 			"Cannot encrypt: Recipient's public key hex is required.",
	// 		);
	// 	}
	// 	let recipientPublicKey: PublicKey;
	// 	try {
	// 		recipientPublicKey = PublicKey.fromString(args.recipientPublicKeyHex);
	// 	} catch (e) {
	// 		throw new Error(
	// 			`Invalid recipient public key hex: ${args.recipientPublicKeyHex}`,
	// 		);
	// 	}
	// 	// TODO: Find the correct ECIES encryption method in @bsv/sdk
	// 	// return senderPaymentKey.encrypt(args.data, recipientPublicKey);
	// 	throw new Error("Encryption not implemented pending ECIES investigation.");
	// }

	// async decrypt(args: { data: Buffer }): Promise<Buffer> {
	// 	const walletPaymentKey = this.getPaymentKey();
	// 	if (!walletPaymentKey) {
	// 		throw new Error("Cannot decrypt: Wallet payment key is not available.");
	// 	}
	// 	// TODO: Find the correct ECIES decryption method in @bsv/sdk
	// 	// return walletPaymentKey.decrypt(args.data);
	// 	throw new Error("Decryption not implemented pending ECIES investigation.");
	// }

	async sendToAddress(
		address: string,
		amountSatoshis: number,
	): Promise<{ txid: string; rawTx?: string }> {
		const pk = this.getPaymentKey();
		if (!pk) throw new Error("Payment key not available to send transaction.");

		const tx = new Transaction();
		tx.addOutput({
			lockingScript: new P2PKH().lock(address),
			satoshis: amountSatoshis,
		});

		const { paymentUtxos } = await this.getUtxos();
		if (paymentUtxos.length === 0)
			throw new Error("No UTXOs available to send.");

		let totalInputSats = 0n;
		const feeModel = new SatoshisPerKilobyte(10);
		let estimatedFee = await feeModel.computeFee(tx);

		for (const utxo of paymentUtxos) {
			if (totalInputSats >= BigInt(amountSatoshis) + BigInt(estimatedFee))
				break;

			const unlockingScriptTemplate = new P2PKH().unlock(
				pk,
				"all",
				false,
				utxo.satoshis,
				Script.fromBinary(Utils.toArray(utxo.script, "hex")),
			);
			const input = fromUtxo(utxo, unlockingScriptTemplate);
			tx.addInput(input);
			totalInputSats += BigInt(utxo.satoshis);
			estimatedFee = await feeModel.computeFee(tx);
		}

		if (totalInputSats < BigInt(amountSatoshis) + BigInt(estimatedFee)) {
			throw new Error(
				`Not enough funds. Required: ${BigInt(amountSatoshis) + BigInt(estimatedFee)}, Available: ${totalInputSats}`,
			);
		}

		const change =
			totalInputSats - (BigInt(amountSatoshis) + BigInt(estimatedFee));
		if (change > 0) {
			const changeAddress = this.getAddress();
			if (!changeAddress)
				throw new Error("Could not determine change address.");
			tx.addOutput({
				lockingScript: new P2PKH().lock(changeAddress),
				satoshis: Number(change),
				change: true,
			});
		}

		await tx.fee(feeModel);
		await tx.sign();

		const rawTx = tx.toHex();
		const txidFromTxObject = tx.id("hex");

		try {
			const broadcaster = new V5Broadcaster();
			const broadcastResult: BroadcastResponse | BroadcastFailure =
				await tx.broadcast(broadcaster);

			if (isBroadcastResponse(broadcastResult)) {
				console.error(
					`Transaction broadcasted successfully: ${broadcastResult.txid}. Message: ${broadcastResult.message}`,
				);
				return { txid: broadcastResult.txid, rawTx };
			}
			if (isBroadcastFailure(broadcastResult)) {
				console.error(
					`Transaction broadcast failed: ${broadcastResult.description} (Code: ${broadcastResult.code}). TXID from object (if available): ${broadcastResult.txid ?? txidFromTxObject}`,
				);
				throw new Error(
					`Broadcast failed: ${broadcastResult.description} (Code: ${broadcastResult.code})`,
				);
			}
			console.error(
				`Transaction broadcast status uncertain. TXID from tx object: ${txidFromTxObject}. Unexpected broadcast result: `,
				broadcastResult,
			);
			return { txid: txidFromTxObject, rawTx };
		} catch (error) {
			console.error(
				"Failed to broadcast transaction (exception caught):",
				error,
			);
			throw new Error(
				`Failed to broadcast transaction ${txidFromTxObject}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}

export default Wallet;
