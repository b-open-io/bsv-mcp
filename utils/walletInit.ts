import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	type ActionLogEntry,
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
import { OneSatServices as ExternalServices } from "@1sat/wallet-remote";
import {
	HTTPWalletJSON,
	PrivateKey,
	PublicKey,
	type WalletInterface,
} from "@bsv/sdk";
import { WalletPermissionsManager } from "@bsv/wallet-toolbox/out/src/index.client.js";
import type { ExternalWalletConfig } from "./externalWalletConfig";
import { redactKeyMaterial } from "./redact";
import {
	handleSpendingAuthorization,
	type SpendingPermissionRequest,
} from "./spendingApproval.ts";

export { setSpendingApprovalServerInstance } from "./spendingApproval.ts";

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

function writeAuditLog(dataDir: string, entry: ActionLogEntry): void {
	try {
		mkdirSync(dataDir, { recursive: true, mode: 0o700 });
		const serialized = JSON.stringify(entry, (_, value) =>
			typeof value === "bigint" ? value.toString() : value,
		);
		appendFileSync(
			join(dataDir, "audit.log"),
			`${redactKeyMaterial(serialized)}\n`,
			{ encoding: "utf8", mode: 0o600 },
		);
	} catch (error) {
		console.error("[wallet] failed to write audit log:", error);
	}
}

export interface WalletInitResult {
	wallet: WalletInterface;
	services: OneSatServices;
	ctx: OneSatContext;
	depositAddress: string;
	destroy: () => Promise<void>;
}

let activeResult: Pick<NodeWalletResult, "destroy"> | null = null;

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
		seekSpendingPermissions: true,
		seekGroupedPermission: false,
		differentiatePrivilegedOperations: false,
		encryptWalletMetadata: true,
	});
	wpm.bindCallback(
		"onSpendingAuthorizationRequested",
		(request: SpendingPermissionRequest) =>
			handleSpendingAuthorization(request, wpm),
	);

	const dataDir = join(homedir(), ".bsv-mcp");

	const ctx = createContext(wpm, {
		services: result.services,
		chain,
		dataDir,
		debug: true,
		log: (entry) => writeAuditLog(dataDir, entry),
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

	activeResult = result;

	return {
		wallet: wpm,
		services: result.services,
		ctx,
		depositAddress,
		destroy: result.destroy,
	};
}

/**
 * Connect to an existing signer without keys, local storage or permission wrappers.
 * The timeout also bounds response body consumption; requests are never retried.
 */
export async function initExternalWallet(
	config: ExternalWalletConfig,
	chain: "main" | "test" = "main",
): Promise<{
	wallet: WalletInterface;
	ctx: OneSatContext;
	services: OneSatServices;
	identityKey: string;
	destroy: () => Promise<void>;
}> {
	const httpClient = ((input, init) =>
		fetch(input, {
			...init,
			redirect: "error",
			signal: init?.signal
				? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)])
				: AbortSignal.timeout(10_000),
		})) as typeof fetch;
	const wallet = new HTTPWalletJSON(config.originator, config.url, httpClient);
	let identityKey: string;
	try {
		const identity = await wallet.getPublicKey({ identityKey: true });
		if (!/^(02|03)[0-9a-f]{64}$/i.test(identity.publicKey)) {
			throw new Error(
				"Signer returned an invalid compressed identity public key",
			);
		}
		PublicKey.fromString(identity.publicKey);
		identityKey = identity.publicKey;
	} catch (error) {
		throw new Error(
			"External BRC-100 signer readiness failed. Check BRC100_WALLET_URL and approve identity access in the signer. This must be SDK signer RPC, not 1sat serve wallet storage RPC. No local wallet was created.",
			{ cause: error },
		);
	}
	// These are API clients only: construction does not provision wallet storage.
	const services = new ExternalServices(chain, process.env.ONESAT_API_URL);
	const dataDir = join(homedir(), ".bsv-mcp");
	const ctx = createContext(wallet, {
		services,
		chain,
		dataDir,
		log: (entry) => writeAuditLog(dataDir, entry),
	});
	// This connection owns no signer resources. Never destroy the remote wallet.
	const destroy = async () => {};
	activeResult = { destroy };
	return { wallet, ctx, services, identityKey, destroy };
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
