import type { OneSatContext } from "@1sat/actions";
import type { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerA2bPublishMcpTool } from "./a2bPublishMcp";
import { registerBrc100Tools } from "./brc100";
import { registerCreateOrdinalsTool } from "./createOrdinals";
import { registerGatherCollectionInfoTool } from "./gatherCollectionInfo";
import { registerGetAddressTool } from "./getAddress";
import { registerWalletGetBalanceTool } from "./getBalance";
import { registerGetBsv21BalancesTool } from "./getBsv21Balances";
import { registerGetLockDataTool } from "./getLockData";
import { registerGetOrdinalsTool } from "./getOrdinals";
import { registerListTokensTool } from "./listTokens";
import { registerMintCollectionTool } from "./mintCollection";
import { registerPurchaseListingTool } from "./purchaseListing";
import { registerRefreshUtxosTool } from "./refreshUtxos";
import { registerSendToAddressTool } from "./sendToAddress";
import { registerSignBsmTool } from "./signBsm";
import { registerTransferOrdTokenTool } from "./transferOrdToken";
import { registerListOrdinalTool } from "./listOrdinal";
import { registerCancelListingTool } from "./cancelListing";
import { registerSendAllBsvTool } from "./sendAllBsv";
import { registerLockBsvTool } from "./lockBsv";
import { registerUnlockBsvTool } from "./unlockBsv";
import { registerOpnsRegisterTool } from "./opnsRegister";
import { registerOpnsDeregisterTool } from "./opnsDeregister";
import { registerSweepBsvTool } from "./sweepBsv";
import { registerSweepOrdinalsTool } from "./sweepOrdinals";
import { registerSweepBsv21Tool } from "./sweepBsv21";
import type { Wallet } from "./wallet";

export function registerWalletTools(
	server: McpServer,
	wallet: Wallet,
	config: {
		disableBroadcasting: boolean;
		enableA2bTools: boolean;
		identityPk?: PrivateKey;
		ctx?: OneSatContext;
	},
): void {
	// Register the wallet_sendToAddress tool
	registerSendToAddressTool(server, config.ctx);

	// Register the wallet_getAddress tool
	registerGetAddressTool(server, config.ctx);

	// Register the wallet_purchaseListing tool
	registerPurchaseListingTool(server, config.ctx);

	// Register the wallet_transferOrdToken tool
	registerTransferOrdTokenTool(server, config.ctx);

	// Register the wallet_refreshUtxos tool
	registerRefreshUtxosTool(server, config.ctx);

	// Register the wallet_getBalance tool
	registerWalletGetBalanceTool(server, config.ctx);

	// Register full BRC-100 wallet interface
	registerBrc100Tools(server, config.ctx);

	// A2B tools have to be explicitly enabled
	if (config.enableA2bTools) {
		// Register the wallet_a2bPublishMcp tool
		registerA2bPublishMcpTool(server, wallet, config.identityPk, {
			disableBroadcasting: config.disableBroadcasting,
		});
	}

	// Register createOrdinals tool
	registerCreateOrdinalsTool(server, config.ctx);

	// Register collection tools
	registerGatherCollectionInfoTool(server, wallet);
	registerMintCollectionTool(server, wallet);

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
