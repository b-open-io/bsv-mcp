import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetBalanceTool } from "./getBalance";
import Mnee from "mnee";
import { registerSendMneeTool } from "./sendMnee";
import { registerParseTxTool } from "./parseTx";

const mnee = new Mnee({
  environment: "production",
});
/**
 * Register all MNEE tools with the MCP server
 * @param server The MCP server instance
 */
export function registerMneeTools(server: McpServer): void {
  // Register MNEE-related tools
  registerGetBalanceTool(server, mnee);

  registerSendMneeTool(server, mnee);

  registerParseTxTool(server, mnee);
}
