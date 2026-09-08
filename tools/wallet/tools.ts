import type { OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerBrc100Tools } from "./brc100";
import { registerCancelListingTool } from "./cancelListing";
import { registerCreateOrdinalsTool } from "./createOrdinals";
import { registerGatherCollectionInfoTool } from "./gatherCollectionInfo";
import { registerGetAddressTool } from "./getAddress";
import { registerWalletGetBalanceTool } from "./getBalance";
import { registerGetBsv21BalancesTool } from "./getBsv21Balances";
import { registerGetLockDataTool } from "./getLockData";
import { registerGetOrdinalsTool } from "./getOrdinals";
import { registerListOrdinalTool } from "./listOrdinal";
import { registerListTokensTool } from "./listTokens";
import { registerLockBsvTool } from "./lockBsv";
import { registerMintCollectionTool } from "./mintCollection";
import { registerOpnsDeregisterTool } from "./opnsDeregister";
import { registerOpnsRegisterTool } from "./opnsRegister";
import { registerPurchaseListingTool } from "./purchaseListing";
import { registerRefreshUtxosTool } from "./refreshUtxos";
import { registerRevealDelegationTool } from "./revealDelegation";
import { registerSendAllBsvTool } from "./sendAllBsv";
import { registerSendBsvTool } from "./sendBsv";
import { registerSignBsmTool } from "./signBsm";
import { registerSweepBsvTool } from "./sweepBsv";
import { registerSweepBsv21Tool } from "./sweepBsv21";
import { registerSweepOrdinalsTool } from "./sweepOrdinals";
import { registerTransferOrdTokenTool } from "./transferOrdToken";
import { registerUnlockBsvTool } from "./unlockBsv";
import type { Wallet } from "./wallet";

export function registerWalletTools(
	server: McpServer,
	wallet: Wallet | undefined,
	config: {
		ctx?: OneSatContext;
		roleContexts?: {
			payments: OneSatContext;
			identity?: OneSatContext;
			ordinals?: OneSatContext;
		};
		/** External signers do not expose the server's broad default-basket read. */
		allowWholeWalletBalance?: boolean;
		/** Project payments sessions do not authorize identity/OneSat operations. */
		scope?: "full" | "payments";
	},
): void {
	const assets = config.roleContexts
		? config.roleContexts.ordinals
		: config.ctx;
	const identity = config.roleContexts
		? config.roleContexts.identity
		: config.ctx;

	registerSendBsvTool(server, config.ctx);

	// Register the wallet_getAddress tool
	registerGetAddressTool(server, config.ctx);

	if (config.scope === "payments") {
		if (config.allowWholeWalletBalance ?? config.ctx?.isBaseWallet !== false)
			registerWalletGetBalanceTool(server, config.ctx);
		return;
	}

	// Register the wallet_purchaseListing tool
	if (!config.roleContexts || assets)
		registerPurchaseListingTool(server, assets);

	// Register the wallet_transferOrdToken tool
	if (!config.roleContexts || assets)
		registerTransferOrdTokenTool(server, assets);

	// Register the wallet_refreshUtxos tool
	registerRefreshUtxosTool(server, config.ctx);

	// wallet_getBalance performs an unconditional default-basket read. That is
	// an owner/admin capability for an embedded wallet and is not part of the
	// application-scoped surface of an external signer.
	const allowWholeWalletBalance =
		config.allowWholeWalletBalance ?? config.ctx?.isBaseWallet !== false;
	if (allowWholeWalletBalance) {
		registerWalletGetBalanceTool(server, config.ctx);
	}

	// Register full BRC-100 wallet interface
	registerBrc100Tools(
		server,
		config.ctx,
		config.roleContexts ? (identity ?? null) : undefined,
	);
	if (!config.roleContexts || identity)
		registerRevealDelegationTool(server, identity);

	// Register createOrdinals tool
	if (!config.roleContexts || assets)
		registerCreateOrdinalsTool(
			server,
			assets,
			config.roleContexts ? (identity ?? null) : undefined,
		);

	// Register collection tools
	if (wallet) {
		registerGatherCollectionInfoTool(server, wallet);
		registerMintCollectionTool(server, wallet);
	}

	// Register read-only wallet tools
	if (!config.roleContexts || assets) registerGetOrdinalsTool(server, assets);
	if (!config.roleContexts || assets) registerListTokensTool(server, assets);
	if (!config.roleContexts || assets)
		registerGetBsv21BalancesTool(server, assets);
	if (!config.roleContexts || assets) registerGetLockDataTool(server, assets);
	if (!config.roleContexts || identity) registerSignBsmTool(server, identity);

	// Register state-changing action tools
	if (!config.roleContexts || assets) registerListOrdinalTool(server, assets);
	if (!config.roleContexts || assets) registerCancelListingTool(server, assets);
	registerSendAllBsvTool(server, config.ctx);
	if (!config.roleContexts || assets) registerLockBsvTool(server, assets);
	if (!config.roleContexts || assets) registerUnlockBsvTool(server, assets);
	if (!config.roleContexts || assets) registerOpnsRegisterTool(server, assets);
	if (!config.roleContexts || assets)
		registerOpnsDeregisterTool(server, assets);

	// Register sweep tools
	registerSweepBsvTool(server, config.ctx);
	if (!config.roleContexts || assets) registerSweepOrdinalsTool(server, assets);
	if (!config.roleContexts || assets) registerSweepBsv21Tool(server, assets);
}
