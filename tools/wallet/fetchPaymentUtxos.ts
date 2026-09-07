import { Utils } from "@bsv/sdk";
import type { Utxo } from "js-1sat-ord";
import { explorerFetch, explorerUrl } from "../../utils/backends";
import { V5_API_URL } from "../constants";
import { getBeefTransactionById } from "./utxo";

const { toHex, toArray } = Utils;

/**
 * Type definition for explorer UTXO response
 */
interface ExplorerUtxo {
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
		// Fetch UTXOs from explorer API
		const response = await explorerFetch(
			`${explorerUrl()}/address/${address}/unspent`,
		);

		if (!response.ok) {
			console.error(
				`explorer API error: ${response.status} ${response.statusText}`,
			);
			return undefined;
		}

		const data = (await response.json()) as ExplorerUtxo[];

		// Validate response format
		if (!Array.isArray(data)) {
			console.error("Invalid response format from explorer API");
			return undefined;
		}

		// For testing purposes (FOR TESTING ONLY - REMOVE IN PRODUCTION)
		// const limitUTXOs = data.slice(0, 2);

		// Process each UTXO
		const utxos: (Utxo | null)[] = await Promise.all(
			data.map(async (utxo: ExplorerUtxo) => {
				// Get the transaction hex to extract the correct script
				const tx = await getBeefTransactionById(utxo.tx_hash);
				const script = tx?.outputs[utxo.tx_pos]?.lockingScript.toHex();
				if (!script) {
					console.error(
						`Could not get script for UTXO: ${utxo.tx_hash}:${utxo.tx_pos}`,
					);
					return null;
				}

				return {
					txid: utxo.tx_hash,
					vout: utxo.tx_pos,
					satoshis: utxo.value,
					script,
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

type V5Utxo = {
	outpoint: string;
	height: number;
	idx: number;
	satoshis: number;
	script: string;
	owners: string[];
	data: Record<string, unknown>;
};

export async function fetchPaymentUtxosFromV5(
	address: string,
): Promise<Utxo[] | undefined> {
	try {
		const url = `${V5_API_URL}/own/${address}/utxos?refresh=true&txo=true&script=true&limit=250&tags=p2pkh`;
		console.error(`Fetching UTXOs from V5: ${url}`);
		const response = await fetch(url);
		if (!response.ok) {
			console.error(
				`V5 UTXO fetch failed: ${response.status} ${response.statusText}`,
			);
			return undefined;
		}
		const data = (await response.json()) as V5Utxo[] | null;
		if (!Array.isArray(data)) {
			console.error(`V5 UTXO response was not an array: ${typeof data}`);
			return undefined;
		}
		const utxos: Utxo[] = [];
		for (const utxo of data) {
			if (!utxo.data.p2pkh) {
				// Skip if not a P2PKH
				continue;
			}
			const [txid, vout] = utxo.outpoint.split("_");
			if (!txid || !vout) {
				console.error(`Invalid outpoint: ${utxo.outpoint}`);
				continue;
			}
			utxos.push({
				txid,
				vout: Number.parseInt(vout, 10),
				satoshis: utxo.satoshis,
				script: toHex(toArray(utxo.script, "base64")),
			} as Utxo);
		}
		return utxos;
	} catch (error) {
		console.error("Error fetching payment UTXOs from V5:", error);
		return undefined;
	}
}
