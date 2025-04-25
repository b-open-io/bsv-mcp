import { P2PKH, Transaction, Utils } from "@bsv/sdk";
import type { Utxo } from "js-1sat-ord";
const { toBase64 } = Utils;

/**
 * Type definition for WhatsOnChain UTXO response
 */
interface WhatsOnChainUtxo {
	tx_hash: string;
	tx_pos: number;
	value: number;
	height: number;
	address?: string;
}

/**
 * Fetches unspent transaction outputs (UTXOs) for a given address.
 * Only returns confirmed unspent outputs.
 *
 * @param address - The address to fetch UTXOs for
 * @returns Array of UTXOs or undefined if an error occurs
 */
export async function fetchPaymentUtxos(
	address: string,
): Promise<Utxo[] | undefined> {
	if (!address) {
		console.error("fetchPaymentUtxos: No address provided");
		return undefined;
	}

	try {
		// Fetch UTXOs from WhatsOnChain API
		const response = await fetch(
			`https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent`,
		);

		if (!response.ok) {
			console.error(
				`WhatsOnChain API error: ${response.status} ${response.statusText}`,
			);
			return undefined;
		}

		const data = (await response.json()) as WhatsOnChainUtxo[];

		// Validate response format
		if (!Array.isArray(data)) {
			console.error("Invalid response format from WhatsOnChain API");
			return undefined;
		}

		// For testing purposes (FOR TESTING ONLY - REMOVE IN PRODUCTION)
		// const limitUTXOs = data.slice(0, 2);

		// Process each UTXO
		const utxos: (Utxo | null)[] = await Promise.all(
			data.map(async (utxo: WhatsOnChainUtxo) => {
				// Get the transaction hex to extract the correct script
				const script = await getScriptFromTransaction(
					utxo.tx_hash,
					utxo.tx_pos,
				);

				if (!script) {
					console.warn(
						`Could not get script for UTXO: ${utxo.tx_hash}:${utxo.tx_pos}`,
					);
					return null;
				}

				return {
					txid: utxo.tx_hash,
					vout: utxo.tx_pos,
					satoshis: utxo.value,
					script: script,
				};
			}),
		);

		// Filter out any null entries from failed processing
		const validUtxos = utxos.filter((utxo) => utxo !== null) as Utxo[];

		return validUtxos;
	} catch (error) {
		console.error("Error fetching payment UTXOs:", error);
		return undefined;
	}
}

/**
 * Gets the script from a transaction for a specific output index
 *
 * @param txid - The transaction ID
 * @param vout - The output index
 * @returns The script as hex string or undefined if an error occurs
 */
async function getScriptFromTransaction(
	txid: string,
	vout: number,
): Promise<string | undefined> {
	try {
		const response = await fetch(
			`https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`,
		);

		if (!response.ok) {
			console.error(
				`WhatsOnChain API error fetching tx hex: ${response.status} ${response.statusText}`,
			);
			return undefined;
		}

		const txHex = await response.text();
		const tx = Transaction.fromHex(txHex);
		const output = tx.outputs[vout];

		if (!output) {
			console.error(`Output index ${vout} not found in transaction ${txid}`);
			return undefined;
		}

		return toBase64(output.lockingScript.toBinary());
	} catch (error) {
		console.error(
			`Error getting script for transaction ${txid}:${vout}:`,
			error,
		);
		return undefined;
	}
}
