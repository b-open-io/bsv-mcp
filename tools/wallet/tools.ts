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
		/** External signers do not expose the server's broad default-basket read. */
		allowWholeWalletBalance?: boolean;
	},
): void {
	registerSendBsvTool(server, config.ctx);

	// Register the wallet_getAddress tool
	registerGetAddressTool(server, config.ctx);

	// Register the wallet_purchaseListing tool
	registerPurchaseListingTool(server, config.ctx);

	// Register the wallet_transferOrdToken tool
	registerTransferOrdTokenTool(server, config.ctx);

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
	registerBrc100Tools(server, config.ctx);
	registerRevealDelegationTool(server, config.ctx);

	// Register createOrdinals tool
	registerCreateOrdinalsTool(server, config.ctx);

	// Register collection tools
	if (wallet) {
		registerGatherCollectionInfoTool(server, wallet);
		registerMintCollectionTool(server, wallet);
	}

	// Register read-only wallet tools
	registerGetOrdinalsTool(server, config.ctx);
	registerListTokensTool(server, config.ctx);
	registerGetBsv21BalancesTool(server, config.ctx);
	registerGetLockDataTool(server, config.ctx);
	registerSignBsmTool(server, config.ctx);

	// Register state-changing action tools
	registerListOrdinalTool(server, config.ctx);
	registerCancelListingTool(server, config.ctx);
	registerSendAllBsvTool(server, config.ctx);
	registerLockBsvTool(server, config.ctx);
	registerUnlockBsvTool(server, config.ctx);
	registerOpnsRegisterTool(server, config.ctx);
	registerOpnsDeregisterTool(server, config.ctx);

	// Register sweep tools
	registerSweepBsvTool(server, config.ctx);
	registerSweepOrdinalsTool(server, config.ctx);
	registerSweepBsv21Tool(server, config.ctx);
}
