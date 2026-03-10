import { createContext, type OneSatContext } from "@1sat/actions";
import {
	BRC29_PROTOCOL_ID,
	createRemoteWallet,
	type OneSatServices,
	type RemoteWalletResult,
} from "@1sat/wallet-remote";
import { PrivateKey, PublicKey, Utils } from "@bsv/sdk";
import type { Wallet } from "@bsv/wallet-toolbox/out/src/index.client.js";

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

function toBase64Prefix(prefix: string): string {
	const encoded = new TextEncoder().encode(prefix);
	return Utils.toBase64(Array.from(encoded));
}

function toBase64Suffix(index: number): string {
	const bytes = [
		(index >>> 24) & 0xff,
		(index >>> 16) & 0xff,
		(index >>> 8) & 0xff,
		index & 0xff,
	];
	return Utils.toBase64(bytes);
}

async function deriveDepositAddress(wallet: Wallet): Promise<string> {
	const derivationPrefix = toBase64Prefix(MCP_ADDRESS_PREFIX);
	const derivationSuffix = toBase64Suffix(0);
	const keyID = `${derivationPrefix} ${derivationSuffix}`;

	const result = await wallet.getPublicKey({
		protocolID: BRC29_PROTOCOL_ID,
		keyID,
		forSelf: true,
	});

	return PublicKey.fromString(result.publicKey).toAddress().toString();
}

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

	const depositAddress = await deriveDepositAddress(result.wallet);

	const ctx = createContext(result.wallet, {
		services: result.services,
		chain,
	});

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
