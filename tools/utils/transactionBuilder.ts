import {
	fromUtxo,
	isBroadcastFailure,
	isBroadcastResponse,
	OP,
	P2PKH,
	type PrivateKey,
	SatoshisPerKilobyte,
	Script,
	Transaction,
} from "@bsv/sdk";
import type { Utxo } from "js-1sat-ord";
import { V5Broadcaster } from "../../utils/broadcaster";

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
	const feeModel = new SatoshisPerKilobyte(feePerByte * 1000);
	tx.addOutput({ lockingScript: p2pkh.lock(changeAddress), satoshis: 0 });
	let estimatedFee = 0;

	// Select larger UTXOs first to limit the number of inputs
	const sortedUtxos = [...utxos].sort((a, b) => b.satoshis - a.satoshis);

	for (const utxo of sortedUtxos) {
		totalInputSatoshis += utxo.satoshis;

		tx.addInput(
			fromUtxo(
				utxo,
				p2pkh.unlock(
					paymentKey,
					"all",
					false,
					utxo.satoshis,
					Script.fromHex(utxo.script),
				),
			),
		);

		// Estimate fee with current inputs
		estimatedFee = await feeModel.computeFee(tx);

		// Check if we have enough to cover outputs + fee + potential change
		if (totalInputSatoshis >= totalOutputSatoshis + estimatedFee) {
			break;
		}
	}

	let change = totalInputSatoshis - totalOutputSatoshis - estimatedFee;
	if (change < DUST_LIMIT) {
		tx.outputs.pop();
		estimatedFee = await feeModel.computeFee(tx);
		change = totalInputSatoshis - totalOutputSatoshis - estimatedFee;
	} else {
		tx.outputs[tx.outputs.length - 1].satoshis = change;
	}
	if (change < 0) {
		return {
			success: false,
			error: `Insufficient funds. Have ${totalInputSatoshis} sats, need ${totalOutputSatoshis + estimatedFee} sats`,
		};
	}
	const fee =
		totalInputSatoshis -
		tx.outputs.reduce((sum, output) => sum + (output.satoshis ?? 0), 0);

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
				success: false,
				txid,
				rawTx,
				fee,
				error: `Transaction created but broadcast failed: ${broadcastResult.description}`,
			};
		}
		return {
			success: false,
			txid,
			rawTx,
			fee,
			error: "Transaction created but broadcast status uncertain",
		};
	} catch (error) {
		return {
			success: false,
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
export function buildOpReturnScript(dataArrays: number[][]): Script {
	const script = new Script([{ op: OP.OP_FALSE }, { op: OP.OP_RETURN }]);
	for (const data of dataArrays) {
		script.writeBin(data);
	}
	return script;
}
