import type { OneSatContext } from "@1sat/actions";
import type { OneSatServices } from "@1sat/client";
import type { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DroplitClient } from "../utils/droplit";
import { registerA2bDiscoverTool } from "./a2b/discover";
import { registerBapTools } from "./bap";
import { registerBsocialTools } from "./bsocial";
import { registerBsvTools } from "./bsv";
import { registerStatusTool } from "./bsv/status";
import { registerX402Tools } from "./bsv/x402";
import { registerMneeTools } from "./mnee";
import { registerOrdinalsTools } from "./ordinals";
import { registerUtilsTools } from "./utils";
import { registerAccountTools } from "./wallet/accounts";
import { registerDroplitTools } from "./wallet/droplit";
import { registerDroplitDiscoveryTool } from "./wallet/droplitDiscovery";
import { registerWalletGetBalanceDroplitTool } from "./wallet/getBalanceDroplit";
import type { IntegratedWallet } from "./wallet/integratedWallet";
import { registerSetupDroplitTools } from "./wallet/setupDroplit";
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
 */
export interface ToolsConfig {
	vaultMigration?: VaultMigrationStatus;
	enableBsvTools?: boolean;
	enableOrdinalsTools?: boolean;
	enableUtilsTools?: boolean;
	enableA2bTools?: boolean;
	enableBapTools?: boolean;
	enableBsocialTools?: boolean;
	enableWalletTools?: boolean;
	enableAccountTools?: boolean;
	enableMneeTools?: boolean;
	identityPk?: PrivateKey;
	payPk?: PrivateKey;
	xprv?: string;
	wallet?: Wallet;
	integratedWallet?: IntegratedWallet;
	disableBroadcasting?: boolean; // For wallet tools
	ctx?: OneSatContext;
	services?: OneSatServices;
	droplitClient?: DroplitClient;
	droplitApiUrl?: string;
}

export interface VaultMigrationStatus {
	available: boolean;
	required: boolean;
	sources: number;
	environmentKeys: { payment: boolean; identity: boolean };
	nextStep: string;
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
	// Register BSV-related tools
	if (enableBsvTools) {
		registerBsvTools(server);
		registerStatusTool(server, config);
		registerX402Tools(server, config);
	}

	// Register Ordinals-related tools
	if (enableOrdinalsTools) {
		registerOrdinalsTools(server, config.ctx?.services ?? config.services);
	}

	// Register utility tools
	if (enableUtilsTools) {
		registerUtilsTools(server);
		const apiUrl =
			config.droplitApiUrl ??
			process.env.DROPLIT_API_URL ??
			config.droplitClient?.getConfig().apiUrl;
		if (apiUrl) registerDroplitDiscoveryTool(server, apiUrl);
	}

	// Register agent-to-blockchain tools
	if (enableA2bTools) {
		registerA2bDiscoverTool(server);
	}

	// Register BAP tools
	if (enableBapTools && (!config.ctx || config.wallet)) {
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

	// Register Wallet tools themselves
	if (enableWalletTools) {
		if (config.enableAccountTools === true && !process.env.BRC100_WALLET_URL)
			registerAccountTools(server);
		if (config.droplitClient)
			registerDroplitTools(
				server,
				config.droplitClient,
				config.disableBroadcasting,
			);
		if (config.integratedWallet?.isDroplitMode) {
			// Register Droplit-mode wallet tools
			const droplitClient = config.integratedWallet.getDroplitClient();
			if (droplitClient) {
				// Register Droplit-specific tools
				registerWalletGetBalanceDroplitTool(server, droplitClient);
				if (config.integratedWallet) {
					registerSetupDroplitTools(server, config.integratedWallet);
				}
				console.error("Registered Droplit mode wallet tools");
			}
		} else if (config.wallet || config.ctx) {
			// Register normal wallet tools
			const walletToolOptions = {
				disableBroadcasting: config.disableBroadcasting === true,
				enableA2bTools: enableA2bTools,
				identityPk: config.identityPk,
				ctx: config.ctx,
			};
			registerWalletTools(server, config.wallet, walletToolOptions);
		}
	}

	// Register MNEE tools
	if (enableMneeTools && (!config.ctx || config.wallet)) {
		registerMneeTools(server);
	}

	// Add more tool categories as needed
}
