import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import all prompt registration functions
import { registerOverviewPrompt } from "./overview";
import { registerWalletPrompt } from "./wallet";
import { registerTransactionPrompt } from "./transaction";
import { registerAuthPrompt } from "./auth";
import { registerCryptographyPrompt } from "./cryptography";
import { registerScriptPrompt } from "./script";
import { registerPrimitivesPrompt } from "./primitives";

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

// Export all prompts
export { registerOverviewPrompt } from "./overview";
export { registerWalletPrompt } from "./wallet";
export { registerTransactionPrompt } from "./transaction";
export { registerAuthPrompt } from "./auth";
export { registerCryptographyPrompt } from "./cryptography";
export { registerScriptPrompt } from "./script";
export { registerPrimitivesPrompt } from "./primitives";