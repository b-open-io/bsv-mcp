import type { McpServer } from "@modelcontextprotocol/server";
import type { Wallet } from "../wallet/wallet";
import { registerBmapReadFollowsTool } from "./bmapFollow";
import { registerBmapReadLikesTool } from "./bmapLikes";
import { registerBmapReadPostsTool } from "./bmapReadPosts";
import { registerCreatePostTool } from "./createPost";
import { registerReadPostsTool } from "./readPosts";

interface BsocialToolsConfig {
	wallet?: Wallet;
}

/**
 * Register all BSocial tools with the MCP server.
 * Public read tools are available without a wallet; post writing remains
 * available only when a custom wallet is supplied.
 * @param server The MCP server instance
 * @param config Configuration including an optional custom wallet
 */
export function registerBsocialTools(
	server: McpServer,
	config: BsocialToolsConfig = {},
): void {
	// Register tools that don't require wallet
	registerReadPostsTool(server);
	console.error("✅ Registered bsocial_readPosts tool");

	// Register BMAP API query tools (read layer)
	registerBmapReadPostsTool(server);
	console.error("✅ Registered bmap_readPosts tool");

	registerBmapReadLikesTool(server);
	console.error("✅ Registered bmap_readLikes tool");

	registerBmapReadFollowsTool(server);
	console.error("✅ Registered bmap_readFollows tool");

	// Register tools that require wallet
	if (config.wallet) {
		registerCreatePostTool(server, config.wallet);
		console.error("✅ Registered bsocial_createPost tool");
	} else {
		console.error(
			"⚠️ bsocial_createPost tool not registered (no wallet available)",
		);
	}
}
