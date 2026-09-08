import type { OneSatContext } from "@1sat/actions";
import type { OneSatServices } from "@1sat/client";
import type { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/server";
import type { DroplitClient } from "../utils/droplit";
import { isExternalWalletContext } from "../utils/externalWalletConfig";
import { registerBapTools } from "./bap";
import { registerBapGetIdTool } from "./bap/getId";
import { registerBsocialTools } from "./bsocial";
import { registerBsvTools } from "./bsv";
import { registerStatusTool } from "./bsv/status";
import { registerX402Tools } from "./bsv/x402";
import {
	registerCompactCatalog,
	resolveToolCatalogProfile,
	type ToolCatalogProfile,
} from "./compactCatalog";
import { registerMneeTools } from "./mnee";
import { registerOrdinalsTools } from "./ordinals";
import { registerUtilsTools } from "./utils";
import { registerAccountTools } from "./wallet/accounts";
import { registerDroplitTools } from "./wallet/droplit";
import { registerDroplitDiscoveryTool } from "./wallet/droplitDiscovery";
import { registerWalletGetBalanceDroplitTool } from "./wallet/getBalanceDroplit";
import type { IntegratedWallet } from "./wallet/integratedWallet";
import {
	isWalletOnboardingAvailable,
	registerWalletOnboardingTool,
} from "./wallet/onboarding";
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
 * - enableBapTools: controlled by DISABLE_BAP_TOOLS
 * - enableBsocialTools: controlled by DISABLE_BSOCIAL_TOOLS
 * - enableWalletTools: controlled by DISABLE_WALLET_TOOLS
 * - enableMneeTools: controlled by DISABLE_MNEE_TOOLS
 */
export interface ToolsConfig {
	localAccountAvailable?: boolean;
	/** True when the connected wallet is owned by an external signer. */
	externalWallet?: boolean;
	/** True when local wallet setup still needs to be completed. */
	walletSetupNeeded?: boolean;
	/**
	 * Dependency-injected opener for the existing authenticated local React
	 * setup server/browser. Resolves once launch is requested; it must not
	 * wait for server shutdown.
	 */
	openWalletSetup?: () => Promise<void>;
	/** Explicit server-side catalog selection; full remains the default. */
	toolCatalog?: ToolCatalogProfile;
	vaultMigration?: VaultMigrationStatus;
	enableBsvTools?: boolean;
	enableOrdinalsTools?: boolean;
	enableUtilsTools?: boolean;
	enableBapTools?: boolean;
	enableBsocialTools?: boolean;
	enableWalletTools?: boolean;
	enableAccountTools?: boolean;
	enableMneeTools?: boolean;
	/** Limit a project-bound payments context to payment-safe wallet calls. */
	walletScope?: "full" | "payments";
	/** Register only the public BAP lookup for modes without local BAP writes. */
	bapPublicOnly?: boolean;
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
	const profile = resolveToolCatalogProfile(config);
	// Ensure defaults are true unless explicitly set to false via env vars or config
	const enableBsvTools =
		process.env.DISABLE_BSV_TOOLS !== "true" && config.enableBsvTools !== false;
	const enableOrdinalsTools =
		process.env.DISABLE_ORDINALS_TOOLS !== "true" &&
		config.enableOrdinalsTools !== false;
	const enableUtilsTools =
		process.env.DISABLE_UTILS_TOOLS !== "true" &&
		config.enableUtilsTools !== false; // Ensure Utils are enabled by default
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

	if (profile === "compact") {
		registerCompactCatalog(server, config);
		return;
	}

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

	// Public BAP lookup remains available without local wallet capabilities.
	if (enableBapTools) {
		const bapConfig: import("./bap").BapToolsConfig = {
			disableBroadcasting: config.disableBroadcasting,
			identityPk: config.identityPk,
			masterXprv: config.xprv,
			localAccountAvailable:
				config.localAccountAvailable === true &&
				config.integratedWallet?.isDroplitMode !== true,
			wallet: config.wallet,
		};
		if (!config.bapPublicOnly && (!config.ctx || config.wallet)) {
			registerBapTools(server, bapConfig);
		} else {
			registerBapGetIdTool(server, config.identityPk);
		}
	}

	// Register BSocial tools. Public reads do not require a wallet; the
	// registration family keeps the post-writing tool wallet-gated.
	if (enableBsocialTools) {
		registerBsocialTools(server, { wallet: config.wallet });
	}

	// Register Wallet tools themselves
	if (enableWalletTools) {
		const externalWallet =
			config.externalWallet ??
			(isExternalWalletContext(config.ctx) ||
				config.ctx?.isBaseWallet === false);
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
				ctx: config.ctx,
				allowWholeWalletBalance: !externalWallet,
				scope: config.walletScope,
			};
			registerWalletTools(server, config.wallet, walletToolOptions);
		}
	}

	// Register MNEE tools
	if (enableMneeTools && (!config.ctx || config.wallet)) {
		registerMneeTools(server);
	}

	// Register the conditional wallet onboarding tool. Availability is
	// controlled only by the caller-provided configuration; there is no
	// startup auto-opening here.
	if (isWalletOnboardingAvailable(config) && config.openWalletSetup) {
		registerWalletOnboardingTool(server, config.openWalletSetup);
	}

	// Add more tool categories as needed
}
