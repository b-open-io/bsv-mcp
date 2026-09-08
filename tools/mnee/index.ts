import type { McpServer } from "@modelcontextprotocol/server";
import { registerGetBalanceTool } from "./getBalance";
import { registerParseTxTool } from "./parseTx";
import { createMneeProvider, type MneeProvider } from "./provider";
import { registerSendMneeTool } from "./sendMnee";

export type {
	MneeClient,
	MneeClientFactory,
	MneeClientSource,
	MneeProvider,
} from "./provider";
export {
	createMneeClient,
	createMneeFactory,
	createMneeProvider,
} from "./provider";

const mneeToolsRegistered = new WeakSet<McpServer>();

/**
 * Register all MNEE tools with the MCP server
 * @param server The MCP server instance
 */
export function registerMneeTools(
	server: McpServer,
	getMnee?: MneeProvider,
): void {
	if (mneeToolsRegistered.has(server)) {
		// console.warn("WARN: MNEE tools already registered for this server instance. Skipping.");
		return;
	}
	const mneeProvider = getMnee ?? createMneeProvider();
	// Register MNEE-related tools
	registerGetBalanceTool(server, mneeProvider);

	registerSendMneeTool(server, mneeProvider);

	registerParseTxTool(server, mneeProvider);
	mneeToolsRegistered.add(server);
}
