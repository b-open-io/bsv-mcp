import { Transaction, Utils } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

// Schema for decode transaction arguments
export const decodeTransactionArgsSchema = z.object({
	tx: z.string().describe("Transaction data or txid"),
	encoding: z
		.enum(["hex", "base64"])
		.default("hex")
		.describe("Encoding of the input data"),
});

export type DecodeTransactionArgs = z.infer<typeof decodeTransactionArgsSchema>;

// Type for JungleBus API response
interface JungleBusTransactionResponse {
	id: string;
	transaction: string;
	block_hash?: string;
	block_height?: number;
	block_time?: number;
	block_index?: number;
	addresses?: string[];
	inputs?: string[];
	outputs?: string[];
	input_types?: string[];
	output_types?: string[];
	contexts?: string[];
	sub_contexts?: string[];
	data?: string[];
	merkle_proof?: unknown;
}

// Network info response type
interface NetworkInfoResponse {
	blocks: number;
	[key: string]: unknown;
}

// Transaction input type
interface TransactionInputData {
	txid: string | undefined;
	vout: number;
	sequence: number | undefined;
	script: string;
	scriptAsm: string;
	type?: string;
	value?: number;
}

// Transaction output type
interface TransactionOutputData {
	n: number;
	value: number | undefined;
	scriptPubKey: {
		hex: string;
		asm: string;
	};
	type?: string;
}

// Transaction result type
interface TransactionResult {
	txid: string;
	version: number;
	locktime: number;
	size: number;
	inputs: TransactionInputData[];
	outputs: TransactionOutputData[];
	confirmations?: number;
	block?: {
		hash: string;
		height: number;
		time: number;
		index: number;
	} | null;
	addresses?: string[];
	fee?: number | null;
	feeRate?: number | null;
}

/**
 * Fetches transaction data from JungleBus
 */
async function fetchJungleBusData(
	txid: string,
): Promise<JungleBusTransactionResponse | null> {
	try {
		const response = await fetch(
			`https://junglebus.gorillapool.io/v1/transaction/get/${txid}`,
		);
		if (!response.ok) {
			console.error(
				`JungleBus API error: ${response.status} ${response.statusText}`,
			);
			return null;
		}
		return (await response.json()) as JungleBusTransactionResponse;
	} catch (error) {
		console.error("Error fetching from JungleBus:", error);
		return null;
	}
}

/**
 * Determines if a string is likely a txid
 */
function isTxid(str: string): boolean {
	// TX IDs are 64 characters in hex (32 bytes)
	return /^[0-9a-f]{64}$/i.test(str);
}

/**
 * Register the BSV transaction decode tool
 */
export function registerDecodeTransactionTool(server: McpServer): void {
	server.tool(
		"bsv_decodeTransaction",
		"Decodes and analyzes Bitcoin SV transactions to provide detailed insights. This powerful tool accepts either a transaction ID or raw transaction data and returns comprehensive information including inputs, outputs, fee calculations, script details, and blockchain context. Supports both hex and base64 encoded transactions and automatically fetches additional on-chain data when available.",
		{
			args: decodeTransactionArgsSchema,
		},
		async (
			{ args }: { args: DecodeTransactionArgs },
			extra: RequestHandlerExtra,
		) => {
			try {
				const { tx, encoding } = args;
				let transaction: Transaction;
				let rawTx: string;
				let txid: string;
				let junglebusData: JungleBusTransactionResponse | null = null;

				// Check if input is txid or raw transaction
				if (isTxid(tx)) {
					// It's a txid, fetch from JungleBus
					txid = tx;
					junglebusData = await fetchJungleBusData(txid);

					if (!junglebusData) {
						throw new Error(
							`Failed to fetch transaction data for txid: ${txid}`,
						);
					}

					// JungleBus returns base64, convert if needed
					rawTx = junglebusData.transaction;
					// Check if rawTx is in base64 format (common from JungleBus)
					const isBase64 = /^[A-Za-z0-9+/=]+$/.test(rawTx);

					if (isBase64) {
						const txBytes = Utils.toArray(rawTx, "base64");
						transaction = Transaction.fromBinary(txBytes);
					} else {
						transaction = Transaction.fromHex(rawTx);
					}
				} else {
					// It's a raw transaction
					let txBytes: number[];

					if (encoding === "hex") {
						txBytes = Utils.toArray(tx, "hex");
					} else {
						txBytes = Utils.toArray(tx, "base64");
					}

					transaction = Transaction.fromBinary(txBytes);
					txid = transaction.hash("hex") as string;

					// Optionally fetch additional context from JungleBus
					junglebusData = await fetchJungleBusData(txid);
				}

				// Basic transaction data
				const result: TransactionResult = {
					txid,
					version: transaction.version,
					locktime: transaction.lockTime,
					size: transaction.toBinary().length,
					inputs: transaction.inputs.map((input) => ({
						txid: input.sourceTXID,
						vout: input.sourceOutputIndex,
						sequence: input.sequence,
						script: input.unlockingScript ? input.unlockingScript.toHex() : "",
						scriptAsm: input.unlockingScript
							? input.unlockingScript.toASM()
							: "",
					})),
					outputs: transaction.outputs.map((output) => ({
						n: transaction.outputs.indexOf(output),
						value: output.satoshis,
						scriptPubKey: {
							hex: output.lockingScript.toHex(),
							asm: output.lockingScript.toASM(),
						},
					})),
				};

				// Add JungleBus context if available
				if (junglebusData) {
					result.confirmations = junglebusData.block_height
						? (await getCurrentBlockHeight()) - junglebusData.block_height + 1
						: 0;

					result.block = junglebusData.block_hash
						? {
								hash: junglebusData.block_hash,
								height: junglebusData.block_height || 0,
								time: junglebusData.block_time || 0,
								index: junglebusData.block_index || 0,
							}
						: null;

					// Add script types
					if (
						junglebusData.input_types &&
						junglebusData.input_types.length > 0
					) {
						result.inputs = result.inputs.map((input, i) => ({
							...input,
							type: junglebusData.input_types?.[i] || "unknown",
						}));
					}

					if (
						junglebusData.output_types &&
						junglebusData.output_types.length > 0
					) {
						result.outputs = result.outputs.map((output, i) => ({
							...output,
							type: junglebusData.output_types?.[i] || "unknown",
						}));
					}

					// Add addresses found in transaction
					if (junglebusData.addresses && junglebusData.addresses.length > 0) {
						result.addresses = junglebusData.addresses;
					}
				}

				// Calculate additional information
				const totalInputValue = result.inputs.reduce(
					(sum, input) => sum + (input.value || 0),
					0,
				);
				const totalOutputValue = result.outputs.reduce(
					(sum, output) => sum + (output.value || 0),
					0,
				);

				result.fee =
					totalInputValue > 0 ? totalInputValue - totalOutputValue : null;
				result.feeRate =
					result.fee !== null
						? Math.round((result.fee / result.size) * 100000000) / 100000000
						: null;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: error instanceof Error ? error.message : String(error),
						},
					],
					isError: true,
				};
			}
		},
	);
}

/**
 * Get current block height
 */
async function getCurrentBlockHeight(): Promise<number> {
	try {
		const response = await fetch(
			"https://junglebus.gorillapool.io/v1/network/info",
		);
		if (!response.ok) {
			return 0;
		}
		const data = (await response.json()) as NetworkInfoResponse;
		return data.blocks || 0;
	} catch (error) {
		console.error("Error fetching current block height:", error);
		return 0;
	}
}
