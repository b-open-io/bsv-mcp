import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAuthPrompt } from "./auth";
import { registerCryptographyPrompt } from "./cryptography";
// Import all prompt registration functions
import { registerOverviewPrompt } from "./overview";
import { registerPrimitivesPrompt } from "./primitives";
import { registerScriptPrompt } from "./script";
import { registerTransactionPrompt } from "./transaction";
import { registerWalletPrompt } from "./wallet";

/**
 * Register all BSV SDK prompts with the MCP server
 * @param server The MCP server instance
 */
export function registerAllBsvSdkPrompts(server: McpServer): void {
	// Register all BSV SDK related prompts
	registerOverviewPrompt(server);
	registerWalletPrompt(server);
	registerTransactionPrompt(server);
	registerAuthPrompt(server);
	registerCryptographyPrompt(server);
	registerScriptPrompt(server);
	registerPrimitivesPrompt(server);
}

export { registerAuthPrompt } from "./auth";
export { registerCryptographyPrompt } from "./cryptography";
// Export all prompts
export { registerOverviewPrompt } from "./overview";
export { registerPrimitivesPrompt } from "./primitives";
export { registerScriptPrompt } from "./script";
export { registerTransactionPrompt } from "./transaction";
export { registerWalletPrompt } from "./wallet";
