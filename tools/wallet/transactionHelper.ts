import { PrivateKey } from "@bsv/sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
	createErrorResponse,
	createResponse,
	formatError,
} from "../utils/errorHandler";
import type { Wallet } from "./wallet";

interface TransactionContext {
	wallet: Wallet;
	identityKey?: string; // WIF from environment
}

interface TransactionResult {
	success: boolean;
	txid?: string;
	rawTx?: string;
	[key: string]: unknown;
}

/**
 * Common transaction workflow wrapper
 */
export async function executeTransaction<TArgs>(
	args: TArgs,
	context: TransactionContext,
	handler: (
		args: TArgs,
		keys: {
			paymentKey: PrivateKey;
			identityKey?: PrivateKey;
			address: string;
		},
		wallet: Wallet,
	) => Promise<TransactionResult>,
): Promise<CallToolResult> {
	try {
		const { wallet, identityKey: identityKeyWif } = context;

		// Get payment key
		const paymentKey = wallet.getPaymentKey();
		if (!paymentKey) {
			throw new Error("Payment key not available");
		}

		// Get address
		const address = await wallet.getAddress();
		if (!address) {
			throw new Error("Could not get wallet address");
		}

		// Parse identity key if provided
		let identityKey: PrivateKey | undefined;
		if (identityKeyWif) {
			try {
				identityKey = PrivateKey.fromWif(identityKeyWif);
			} catch (e) {
				console.warn(
					"Invalid IDENTITY_KEY_WIF provided, skipping identity features",
				);
			}
		}

		// Execute the transaction handler
		const result = await handler(
			args,
			{ paymentKey, identityKey, address: address.toString() },
			wallet,
		);

		// Refresh UTXOs after successful transaction
		if (
			result.success &&
			result.txid &&
			process.env.DISABLE_BROADCASTING !== "true"
		) {
			wallet.refreshUtxos().catch((err) => {
				console.warn("Failed to refresh UTXOs after transaction:", err);
			});
		}

		return createResponse(result);
	} catch (error) {
		return createErrorResponse(error);
	}
}

/**
 * Get identity key from environment
 */
export function getIdentityKeyFromEnv(): PrivateKey | undefined {
	const identityKeyWif = process.env.IDENTITY_KEY_WIF;
	if (!identityKeyWif) return undefined;

	try {
		return PrivateKey.fromWif(identityKeyWif);
	} catch (e) {
		console.warn("Invalid IDENTITY_KEY_WIF in environment:", formatError(e));
		return undefined;
	}
}

/**
 * Standard response for disabled broadcasting
 */
export function createDisabledBroadcastResponse(
	txid: string,
	rawTx: string,
	extra?: Record<string, unknown>,
): TransactionResult {
	return {
		success: true,
		txid,
		rawTx,
		broadcastDisabled: true,
		message:
			"Broadcasting disabled. Use the raw transaction hex to broadcast manually.",
		...extra,
	};
}
