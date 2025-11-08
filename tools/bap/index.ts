import type { PrivateKey } from "@bsv/sdk";
import HD from "@bsv/sdk/compat/HD";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Wallet } from "../wallet/wallet";
import { registerBapFriendTool } from "./friend";
import { registerBapGenerateTool } from "./generate";
import { registerBapGetCurrentAddressTool } from "./getCurrentAddress";
import { registerBapGetIdTool } from "./getId";

const logFunc = console.error;

/**
 * Configuration for BAP tools registration.
 */
export interface BapToolsConfig {
	disableBroadcasting?: boolean;
	identityPk?: PrivateKey;
	masterXprv?: string;
	wallet?: Wallet;
}

/**
 * Register all BAP tools with the MCP server
 * @param server The MCP server instance
 * @param identityPk The optional identity private key for operations requiring it
 * @param masterXprv The BAP HD Master Key (xprv string) if available.
 * @param config Configuration options for BAP tools.
 */
export function registerBapTools(
	server: McpServer,
	config?: BapToolsConfig,
): void {
	const {
		identityPk, // Server's main configured identity (from keys.json or IDENTITY_KEY_WIF)
		masterXprv, // Server's master BAP key (from keys.json)
		wallet,
		disableBroadcasting = false,
	} = config || {};

	const envIdentityKeyWif = process.env.IDENTITY_KEY_WIF;

	// --- Register bap_generate ONLY if no identity exists ---
	const canGenerateBapIdentity = !envIdentityKeyWif && !masterXprv;
	if (canGenerateBapIdentity) {
		logFunc(
			"INFO: Registering bap_generate tool. No master identity (xprv) or direct identity WIF found.",
		);
		registerBapGenerateTool(server, { disableBroadcasting });
	} else {
		logFunc(
			"INFO: bap_generate tool not registered. Master identity (xprv) or direct identity WIF already exists.",
		);
	}

	// --- Register tools requiring an established identity ---
	// Established identity means either an identityPk was loaded/configured, OR an env var was set.
	const hasEstablishedIdentity = !!identityPk || !!envIdentityKeyWif;

	if (hasEstablishedIdentity) {
		logFunc(
			"INFO: Registering BAP tools that require an established identity (bap_getId, bap_getCurrentAddress).",
		);
		// registerBapGetIdTool can use server's identityPk if available

		// registerBapGetCurrentAddressTool strictly requires the server's identityPk (not just env var)
		if (identityPk) {
			registerBapGetCurrentAddressTool(server, identityPk);
		} else {
			logFunc(
				"WARN: bap_getCurrentAddress tool not registered. Server identityPk not available (might be using env var directly).",
			);
		}
	} else {
		logFunc(
			"INFO: BAP tools requiring established identity not registered (no identityPk or IDENTITY_KEY_WIF).",
		);
		// We might still want bap_getId available even without server identity,
		// as it can take an idKey argument. Let's register it outside the check.
		// Moved registerBapGetIdTool outside this block - see below.
	}

	// Always register bap_getId as it can operate on user-provided idKey too.
	// If server identityPk is available, it can use it as default.
	registerBapGetIdTool(server, identityPk);

	// --- Register tools requiring the master HD key (xprv) ---
	if (masterXprv) {
		try {
			// No need to parse HD key here if tools don't need the HD object itself
			// const masterHdKey = HD.fromString(masterXprv);

			// Register bap_friend if wallet is also available
			if (wallet) {
				logFunc(
					"INFO: Registering bap_friend tool (requires wallet & masterXprv).",
				);
				registerBapFriendTool(server, wallet, masterXprv, {
					disableBroadcasting,
				});
			} else {
				logFunc("WARN: Wallet not available, bap_friend tool not registered.");
			}

			// Add other tools that specifically require masterXprv here...
		} catch (e) {
			// Catch potential HD.fromString errors if parsing is done here
			console.error(
				`ERROR: Failed during masterXprv tool registration: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}
}
