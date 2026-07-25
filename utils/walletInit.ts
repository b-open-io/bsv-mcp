import { homedir } from "node:os";
import { join } from "node:path";
import {
	createContext,
	deriveDepositAddresses,
	type OneSatContext,
	syncMessages,
} from "@1sat/actions";
import {
	createNodeWallet,
	type NodeWalletResult,
	type OneSatServices,
} from "@1sat/wallet-node";
import { PrivateKey, type WalletInterface } from "@bsv/sdk";
import { WalletPermissionsManager } from "@bsv/wallet-toolbox/out/src/index.client.js";

const DEFAULT_REMOTE_STORAGE_URL = "https://api.1sat.app/1sat/wallet";

/**
 * The originator that bypasses every permission check in
 * WalletPermissionsManager — isAdminOriginator short-circuits
 * ensureSpendingAuthorization to true before any spending gate runs.
 *
 * This was the package name, "bsv-mcp", which is the exact string a caller
 * reaches for when a parameter named `originator` needs a value. Passing it
 * from a tool would disable the spending gate while the configuration still
 * reported it armed. It is deliberately a name no tool would send.
 *
 * It must never normalize to the empty string: normalizeOriginator(undefined)
 * returns "", so an empty admin originator would make every anonymous call
 * admin and disable the gate entirely.
 */
export const ADMIN_ORIGINATOR = "admin.bsv-mcp.internal";
const MCP_ADDRESS_PREFIX = "mcp";

export interface WalletInitResult {
	wallet: WalletInterface;
	services: OneSatServices;
	ctx: OneSatContext;
	depositAddress: string;
	destroy: () => Promise<void>;
}

let activeResult:
	| (NodeWalletResult & { ctx: OneSatContext; depositAddress: string })
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
	const result = await createNodeWallet({
		privateKey: PrivateKey.fromWif(privateKeyWif),
		chain,
		activeRemote: process.env.REMOTE_STORAGE_URL ?? DEFAULT_REMOTE_STORAGE_URL,
		storageIdentityKey: "bsv-mcp",
	});

	const wpm = new WalletPermissionsManager(result.wallet, ADMIN_ORIGINATOR, {
		seekProtocolPermissionsForSigning: false,
		seekProtocolPermissionsForEncrypting: false,
		seekProtocolPermissionsForHMAC: false,
		seekPermissionsForKeyLinkageRevelation: false,
		seekPermissionsForPublicKeyRevelation: false,
		seekPermissionsForIdentityKeyRevelation: false,
		seekPermissionsForIdentityResolution: false,
		seekBasketInsertionPermissions: false,
		seekBasketRemovalPermissions: false,
		seekBasketListingPermissions: false,
		seekPermissionWhenApplyingActionLabels: false,
		seekPermissionWhenListingActionsByLabel: false,
		seekCertificateAcquisitionPermissions: false,
		seekCertificateRelinquishmentPermissions: false,
		seekCertificateListingPermissions: false,
		seekCertificateDisclosurePermissions: false,
		seekSpendingPermissions: false,
		seekGroupedPermission: false,
		differentiatePrivilegedOperations: false,
		encryptWalletMetadata: true,
	});

	const dataDir = join(homedir(), ".bsv-mcp");

	const ctx = createContext(wpm, {
		services: result.services,
		chain,
		dataDir,
	});

	const { derivations } = await deriveDepositAddresses.execute(ctx, {
		prefix: MCP_ADDRESS_PREFIX,
	});
	const depositAddress = derivations[0].address;

	// Sync incoming paymail payments from message box
	syncMessages
		.execute(ctx, {})
		.then((r) => {
			if (r.processed > 0) {
				console.log(`[wallet] synced ${r.processed} message box payments`);
			}
		})
		.catch((err) => {
			console.error("[wallet] message box sync failed:", err);
		});

	activeResult = { ...result, ctx, depositAddress };

	return {
		wallet: wpm,
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
