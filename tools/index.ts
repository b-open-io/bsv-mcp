import type { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerA2aCallTool } from "./a2b/call";
import { registerA2bDiscoverTool } from "./a2b/discover";
import { registerBapTools } from "./bap";
import { registerBigBlocksTools } from "./bigblocks";
import { registerBsocialTools } from "./bsocial";
import { registerBsvTools } from "./bsv";
import { registerMneeTools } from "./mnee";
import { registerOrdinalsTools } from "./ordinals";
import { registerUtilsTools } from "./utils";
import type { IntegratedWallet } from "./wallet/integratedWallet";
import { registerWalletTools } from "./wallet/tools";
import type { Wallet } from "./wallet/wallet";

/**
 * Configuration options for tools
 *
 * These options can be controlled through environment variables:
 * - enableBsvTools: controlled by DISABLE_BSV_TOOLS
 * - enableOrdinalsTools: controlled by DISABLE_ORDINALS_TOOLS
 * - enableUtilsTools: controlled by DISABLE_UTILS_TOOLS
 * - enableA2bTools: controlled by ENABLE_A2B_TOOLS (disabled by default)
 * - enableBapTools: controlled by DISABLE_BAP_TOOLS
 * - enableBsocialTools: controlled by DISABLE_BSOCIAL_TOOLS
 * - enableWalletTools: controlled by DISABLE_WALLET_TOOLS
 * - enableMneeTools: controlled by DISABLE_MNEE_TOOLS
 * - enableBigBlocksTools: controlled by DISABLE_BIGBLOCKS_TOOLS
 */
export interface ToolsConfig {
	enableBsvTools?: boolean;
	enableOrdinalsTools?: boolean;
	enableUtilsTools?: boolean;
	enableA2bTools?: boolean;
	enableBapTools?: boolean;
	enableBsocialTools?: boolean;
	enableWalletTools?: boolean;
	enableMneeTools?: boolean;
	enableBigBlocksTools?: boolean;
	identityPk?: PrivateKey;
	payPk?: PrivateKey;
	xprv?: string;
	wallet?: Wallet;
	integratedWallet?: IntegratedWallet;
	disableBroadcasting?: boolean; // For wallet tools
}

/**
 * Register all tools with the MCP server based on configuration
 * @param server The MCP server instance
 * @param config Configuration options
 */
export function registerAllTools(
	server: McpServer,
	config: ToolsConfig = {},
): void {
	// Ensure defaults are true unless explicitly set to false via env vars or config
	const enableBsvTools =
		process.env.DISABLE_BSV_TOOLS !== "true" && config.enableBsvTools !== false;
	const enableOrdinalsTools =
		process.env.DISABLE_ORDINALS_TOOLS !== "true" &&
		config.enableOrdinalsTools !== false;
	const enableUtilsTools =
		process.env.DISABLE_UTILS_TOOLS !== "true" &&
		config.enableUtilsTools !== false; // Ensure Utils are enabled by default
	const enableA2bTools =
		process.env.ENABLE_A2B_TOOLS === "true" && config.enableA2bTools !== false;
	const enableBapTools =
		process.env.DISABLE_BAP_TOOLS !== "true" && config.enableBapTools !== false;
	const enableWalletTools =
		process.env.DISABLE_WALLET_TOOLS !== "true" &&
		config.enableWalletTools !== false;
	const enableMneeTools =
		process.env.DISABLE_MNEE_TOOLS !== "true" &&
		config.enableMneeTools !== false;
	const enableBsocialTools =
		process.env.DISABLE_BSOCIAL_TOOLS !== "true" &&
		config.enableBsocialTools !== false;
	const enableBigBlocksTools =
		process.env.DISABLE_BIGBLOCKS_TOOLS !== "true" &&
		config.enableBigBlocksTools !== false;

	// Register BSV-related tools
	if (enableBsvTools) {
		registerBsvTools(server);
	}

	// Register Ordinals-related tools
	if (enableOrdinalsTools) {
		registerOrdinalsTools(server);
	}

	// Register utility tools
	if (enableUtilsTools) {
		registerUtilsTools(server);
	}

	// Register agent-to-blockchain tools
	if (enableA2bTools) {
		registerA2bDiscoverTool(server);
		// registerA2aCallTool(server);
	}

	// Register BAP tools
	if (enableBapTools) {
		const bapConfig: import("./bap").BapToolsConfig = {
			disableBroadcasting: config.disableBroadcasting,
			identityPk: config.identityPk,
			masterXprv: config.xprv,
			wallet: config.wallet,
		};
		registerBapTools(server, bapConfig);
	}

	// Register BSocial tools
	if (enableBsocialTools && config.wallet) {
		registerBsocialTools(server, { wallet: config.wallet });
	}

	// Register BigBlocks tools
	if (enableBigBlocksTools) {
		registerBigBlocksTools(server);
	}

	// Register Wallet tools themselves
	if (enableWalletTools) {
		if (config.integratedWallet?.isDropletMode) {
			// Register Droplet-mode wallet tools
			const dropletClient = config.integratedWallet.getDropletClient();
			if (dropletClient) {
				// Register Droplet-specific tools
				import("./wallet/getBalanceDroplet").then(
					({ registerWalletGetBalanceDropletTool }) => {
						registerWalletGetBalanceDropletTool(server, dropletClient);
					},
				);
				import("./wallet/setupDroplet").then(({ registerSetupDropletTool }) => {
					if (config.integratedWallet) {
						registerSetupDropletTool(server, config.integratedWallet);
					}
				});
				console.error("Registered Droplet mode wallet tools");
			}
		} else if (config.wallet) {
			// Register normal wallet tools
			const walletToolOptions = {
				disableBroadcasting: config.disableBroadcasting === true, // Default to false if undefined
				enableA2bTools: enableA2bTools, // Use the already determined enableA2bTools value
				identityPk: config.identityPk,
			};
			registerWalletTools(server, config.wallet, walletToolOptions);
		}
	}

	// Register MNEE tools
	if (enableMneeTools) {
		registerMneeTools(server);
	}

	// Add more tool categories as needed
}
