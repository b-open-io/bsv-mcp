import type {
	MNEEBalance,
	ParseOptions,
	ParseTxResponse,
	SendMNEE,
	TransferResponse,
	TransferStatus,
} from "mnee";

/**
 * The subset of the MNEE client used by the MCP tools.
 *
 * Keeping this contract local means the registration and handler code does
 * not need a runtime import from the MNEE package.
 */
export interface MneeClient {
	balance(address: string): Promise<MNEEBalance>;
	transfer(request: SendMNEE[], wif: string): Promise<TransferResponse>;
	getTxStatus(ticketId: string): Promise<TransferStatus>;
	parseTx(txid: string, options?: ParseOptions): Promise<ParseTxResponse>;
}

/** A provider shared by all handlers registered for one MCP server. */
export type MneeProvider = () => Promise<MneeClient>;

/** A source accepted by the low-level registration helpers. */
export type MneeClientSource = MneeClient | MneeProvider;

/** A client factory may be synchronous or asynchronous for straightforward tests. */
export type MneeClientFactory = () => MneeClient | PromiseLike<MneeClient>;

/** Resolve either a lazy provider or a prebuilt client supplied by a caller. */
export function resolveMneeClient(
	source: MneeClientSource,
): Promise<MneeClient> {
	return typeof source === "function" ? source() : Promise.resolve(source);
}

/**
 * Load and construct the production MNEE client only when requested.
 *
 * This function is intentionally separate from `createMneeProvider` so tests
 * can inject a pure in-memory factory without mocking the process-wide module
 * registry.
 */
export async function createMneeClient(): Promise<MneeClient> {
	const { default: Mnee } = await import("mnee");
	return new Mnee({ environment: "production" });
}

/**
 * Wrap a client factory with shared, retryable initialization.
 *
 * A pending initialization is shared by concurrent callers. Rejected
 * initialization is discarded so a later tool call can try again.
 */
export function createMneeProvider(
	factory: MneeClientFactory = createMneeClient,
): MneeProvider {
	let pending: Promise<MneeClient> | undefined;

	return () => {
		if (pending) return pending;

		let initialization: Promise<MneeClient>;
		try {
			initialization = Promise.resolve(factory());
		} catch (error) {
			initialization = Promise.reject(error);
		}

		pending = initialization.then(
			(value) => value,
			(error) => {
				pending = undefined;
				throw error;
			},
		);
		return pending;
	};
}

/** Compatibility alias that makes the factory seam discoverable by name. */
export const createMneeFactory = createMneeProvider;
