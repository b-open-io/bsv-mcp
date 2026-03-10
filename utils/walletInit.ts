import {
	createContext,
	deriveDepositAddresses,
	type OneSatContext,
} from "@1sat/actions";
import {
	createRemoteWallet,
	type OneSatServices,
	type RemoteWalletResult,
} from "@1sat/wallet-remote";
import { PrivateKey } from "@bsv/sdk";
import type { Wallet } from "@bsv/wallet-toolbox/out/src/index.client.js";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_REMOTE_STORAGE_URL = "https://1sat.shruggr.cloud/1sat/wallet";
const MCP_ADDRESS_PREFIX = "mcp";

export interface WalletInitResult {
	wallet: Wallet;
	services: OneSatServices;
	ctx: OneSatContext;
	depositAddress: string;
	destroy: () => Promise<void>;
}

let activeResult:
	| (RemoteWalletResult & { ctx: OneSatContext; depositAddress: string })
	| null = null;

/**
 * Initialize the BRC-100 remote wallet.
 *
 * @param privateKeyWif - Payment private key in WIF format
 * @param chain - Network chain ('main' or 'test')
 */
export async function initWallet(
	privateKeyWif: string,
	chain: "main" | "test" = "main",
): Promise<WalletInitResult> {
	const remoteStorageUrl =
		process.env.REMOTE_STORAGE_URL ?? DEFAULT_REMOTE_STORAGE_URL;

	const result = await createRemoteWallet({
		privateKey: PrivateKey.fromWif(privateKeyWif),
		chain,
		remoteStorageUrl,
	});

	const dataDir = join(homedir(), ".bsv-mcp");

	const ctx = createContext(result.wallet, {
		services: result.services,
		chain,
		dataDir,
	});

	const { derivations } = await deriveDepositAddresses.execute(ctx, {
		prefix: MCP_ADDRESS_PREFIX,
	});
	const depositAddress = derivations[0].address;

	activeResult = { ...result, ctx, depositAddress };

	return {
		wallet: result.wallet,
		services: result.services,
		ctx,
		depositAddress,
		destroy: result.destroy,
	};
}

/**
 * Destroy the active wallet instance and release resources.
 */
export async function destroyWallet(): Promise<void> {
	if (activeResult) {
		await activeResult.destroy();
		activeResult = null;
	}
}
