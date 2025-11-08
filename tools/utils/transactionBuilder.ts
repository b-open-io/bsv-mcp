import { P2PKH, type PrivateKey, Script, Transaction, Utils } from "@bsv/sdk";
import { isBroadcastFailure, isBroadcastResponse } from "@bsv/sdk";
import { V5Broadcaster } from "../../utils/broadcaster";
import type { Utxo } from "../wallet/utxo";

const DEFAULT_SAT_PER_BYTE = 0.05;
const DUST_LIMIT = 546;

interface TransactionBuilderConfig {
	outputs: Array<{
		script?: Script;
		address?: string;
		satoshis: number;
	}>;
	utxos: Utxo[];
	changeAddress: string;
	paymentKey: PrivateKey;
	feePerByte?: number;
}

interface TransactionResult {
	success: boolean;
	txid?: string;
	rawTx?: string;
	error?: string;
	fee?: number;
}

/**
 * Build and optionally broadcast a transaction with automatic UTXO selection and fee calculation
 */
export async function buildAndSendTransaction(
	config: TransactionBuilderConfig,
	broadcast = true,
): Promise<TransactionResult> {
	const {
		outputs,
		utxos,
		changeAddress,
		paymentKey,
		feePerByte = DEFAULT_SAT_PER_BYTE,
	} = config;

	if (!utxos || utxos.length === 0) {
		return {
			success: false,
			error: "No UTXOs available to fund transaction",
		};
	}

	const tx = new Transaction();
	const p2pkh = new P2PKH();

	// Add all outputs
	for (const output of outputs) {
		if (output.script) {
			tx.addOutput({
				lockingScript: output.script,
				satoshis: output.satoshis,
			});
		} else if (output.address) {
			tx.addOutput({
				lockingScript: p2pkh.lock(output.address),
				satoshis: output.satoshis,
			});
		}
	}

	// Calculate total output amount
	const totalOutputSatoshis = outputs.reduce(
		(sum, out) => sum + out.satoshis,
		0,
	);

	// Select UTXOs and add inputs
	let totalInputSatoshis = 0;
	const selectedUtxos: Utxo[] = [];

	// Sort UTXOs by value (ascending) to minimize the number of inputs
	const sortedUtxos = [...utxos].sort((a, b) => a.satoshis - b.satoshis);

	for (const utxo of sortedUtxos) {
		selectedUtxos.push(utxo);
		totalInputSatoshis += utxo.satoshis;

		const input = {
			sourceTransaction: utxo.tx,
			sourceOutputIndex: utxo.vout,
			unlockingScriptTemplate: p2pkh.unlock(paymentKey),
		};
		tx.addInput(input);

		// Estimate fee with current inputs
		const estimatedSize = tx.toHex().length / 2 + 150; // rough estimate for unsigned tx
		const estimatedFee = Math.ceil(estimatedSize * feePerByte);

		// Check if we have enough to cover outputs + fee + potential change
		if (totalInputSatoshis >= totalOutputSatoshis + estimatedFee + DUST_LIMIT) {
			break;
		}
	}

	// Calculate final fee
	const estimatedSize = tx.toHex().length / 2 + 35; // more accurate with all inputs
	const fee = Math.ceil(estimatedSize * feePerByte);

	// Check if we have enough funds
	if (totalInputSatoshis < totalOutputSatoshis + fee) {
		return {
			success: false,
			error: `Insufficient funds. Have ${totalInputSatoshis} sats, need ${totalOutputSatoshis + fee} sats`,
		};
	}

	// Add change output if needed
	const change = totalInputSatoshis - totalOutputSatoshis - fee;
	if (change >= DUST_LIMIT) {
		tx.addOutput({
			lockingScript: p2pkh.lock(changeAddress),
			satoshis: change,
		});
	}

	// Sign the transaction
	await tx.sign();

	const rawTx = tx.toHex();
	const txid = tx.id("hex") as string;

	// Check if broadcasting is disabled
	if (process.env.DISABLE_BROADCASTING === "true" || !broadcast) {
		return {
			success: true,
			txid,
			rawTx,
			fee,
		};
	}

	// Broadcast the transaction
	try {
		const broadcaster = new V5Broadcaster();
		const broadcastResult = await tx.broadcast(broadcaster);

		if (isBroadcastResponse(broadcastResult)) {
			return {
				success: true,
				txid: broadcastResult.txid || txid,
				rawTx,
				fee,
			};
		}
		if (isBroadcastFailure(broadcastResult)) {
			return {
				success: true,
				txid,
				rawTx,
				fee,
				error: `Transaction created but broadcast failed: ${broadcastResult.description}`,
			};
		}
		return {
			success: true,
			txid,
			rawTx,
			fee,
			error: "Transaction created but broadcast status uncertain",
		};
	} catch (error) {
		return {
			success: true,
			txid,
			rawTx,
			fee,
			error: `Transaction created but broadcast failed: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Build OP_RETURN script from data arrays
 */
export function buildOpReturnScript(dataArrays: Uint8Array[]): Script {
	return new Script([
		{ op: 0 }, // OP_0
		{ op: 106 }, // OP_RETURN
		...dataArrays.map((data) => ({ data })),
	]);
}
