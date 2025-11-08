import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
 * Register all BSocial tools with the MCP server
 * @param server The MCP server instance
 * @param config Configuration including wallet instance
 */
export function registerBsocialTools(
	server: McpServer,
	config: BsocialToolsConfig,
): void {
	// Register tools that don't require wallet
	registerReadPostsTool(server);
	console.log("✅ Registered bsocial_readPosts tool");

	// Register BMAP API query tools (read layer)
	registerBmapReadPostsTool(server);
	console.log("✅ Registered bmap_readPosts tool");

	registerBmapReadLikesTool(server);
	console.log("✅ Registered bmap_readLikes tool");

	registerBmapReadFollowsTool(server);
	console.log("✅ Registered bmap_readFollows tool");

	// Register tools that require wallet
	if (config.wallet) {
		registerCreatePostTool(server, config.wallet);
		console.log("✅ Registered bsocial_createPost tool");
	} else {
		console.log(
			"⚠️ bsocial_createPost tool not registered (no wallet available)",
		);
	}
}
