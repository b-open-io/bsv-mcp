import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBigBlocksComponentTool } from "./components.js";
import { registerBigBlocksDocsTool } from "./docs.js";
import { registerBigBlocksExamplesTool } from "./examples.js";
import { registerBigBlocksGeneratorTool } from "./generator.js";

/**
 * Register all BigBlocks tools with the MCP server
 * @param server The MCP server instance
 */
export function registerBigBlocksTools(server: McpServer): void {
	// Component discovery and information
	registerBigBlocksComponentTool(server);

	// Documentation and guides
	registerBigBlocksDocsTool(server);

	// Code generation helpers
	registerBigBlocksGeneratorTool(server);

	// Examples and patterns
	registerBigBlocksExamplesTool(server);
}
