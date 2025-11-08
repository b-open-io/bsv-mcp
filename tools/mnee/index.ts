import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import Mnee from "mnee";
import { registerGetBalanceTool } from "./getBalance";
import { registerParseTxTool } from "./parseTx";
import { registerSendMneeTool } from "./sendMnee";

const mnee = new Mnee({
	environment: "production",
});

const mneeToolsRegistered = new WeakSet<McpServer>();

/**
 * Register all MNEE tools with the MCP server
 * @param server The MCP server instance
 */
export function registerMneeTools(server: McpServer): void {
	if (mneeToolsRegistered.has(server)) {
		// console.warn("WARN: MNEE tools already registered for this server instance. Skipping.");
		return;
	}
	// Register MNEE-related tools
	registerGetBalanceTool(server, mnee);

	registerSendMneeTool(server, mnee);

	registerParseTxTool(server, mnee);
	mneeToolsRegistered.add(server);
}
