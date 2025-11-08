import { Transaction } from "@bsv/sdk";

export async function getTransactionById(
	txid: string,
): Promise<Transaction | null> {
	const url = `https://junglebus.gorillapool.io/v1/transaction/${txid}`;
	try {
		const response = await fetch(url);
		if (!response.ok) {
			console.error(
				`Failed to fetch transaction ${txid} from Junglebus: ${response.status} ${response.statusText}`,
			);
			return null;
		}
		const rawTxBuffer = await response.arrayBuffer();
		if (!rawTxBuffer) {
			console.error(`Empty raw transaction buffer for ${txid} from Junglebus`);
			return null;
		}

		const uint8Array = arrayBufferToUint8Array(rawTxBuffer);
		const tx = Transaction.fromBinary(uint8Array);

		return tx;
	} catch (error) {
		console.error(
			`Error fetching or parsing transaction ${txid}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

export async function getBeefTransactionById(
	txid: string,
): Promise<Transaction | null> {
	const url = `https://junglebus.gorillapool.io/v1/transaction/beef/${txid}`;
	try {
		// console.error("URL:", url);
		const response = await fetch(url);
		if (!response.ok) {
			console.warn(
				`Failed to fetch transaction ${txid} from Junglebus: ${response.status} ${response.statusText}`,
			);
			return null;
		}
		const rawTxBuffer = await response.arrayBuffer();
		if (!rawTxBuffer) {
			console.warn(`Empty raw transaction buffer for ${txid} from Junglebus`);
			return null;
		}

		const uint8Array = arrayBufferToUint8Array(rawTxBuffer);
		const tx = Transaction.fromBEEF(uint8Array, txid);

		return tx;
	} catch (error) {
		console.warn(
			`Error fetching or parsing transaction ${txid}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}
