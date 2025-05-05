import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerA2aCallTool } from "./a2b/call";
import { registerA2bDiscoverTool } from "./a2b/discover";
import { registerBsvTools } from "./bsv";
import { registerOrdinalsTools } from "./ordinals";
import { registerUtilsTools } from "./utils";

/**
 * Configuration options for tools
 *
 * These options can be controlled through environment variables:
 * - enableBsvTools: controlled by DISABLE_BSV_TOOLS
 * - enableOrdinalsTools: controlled by DISABLE_ORDINALS_TOOLS
 * - enableUtilsTools: controlled by DISABLE_UTILS_TOOLS
 * - enableA2bTools: controlled by DISABLE_A2B_TOOLS
 */
export interface ToolsConfig {
	enableBsvTools?: boolean;
	enableOrdinalsTools?: boolean;
	enableUtilsTools?: boolean;
	enableA2bTools?: boolean;
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
	// Ensure defaults are true unless explicitly set to false via env vars or config
	const enableBsvTools =
		process.env.DISABLE_BSV_TOOLS !== "true" && config.enableBsvTools !== false;
	const enableOrdinalsTools =
		process.env.DISABLE_ORDINALS_TOOLS !== "true" &&
		config.enableOrdinalsTools !== false;
	const enableUtilsTools =
		process.env.DISABLE_UTILS_TOOLS !== "true" &&
		config.enableUtilsTools !== false; // Ensure Utils are enabled by default
	const enableA2bTools =
		process.env.DISABLE_A2B_TOOLS !== "true" && config.enableA2bTools !== false; // Corrected A2B check

	// Register BSV-related tools
	if (enableBsvTools) {
		registerBsvTools(server);
	}

	// Register Ordinals-related tools
	if (enableOrdinalsTools) {
		registerOrdinalsTools(server);
	}

	// Register utility tools
	if (enableUtilsTools) {
		registerUtilsTools(server);
	}

	// Register agent-to-blockchain tools
	if (enableA2bTools) {
		// Register agent-to-blockchain discovery tool
		registerA2bDiscoverTool(server);

		// Register agent-to-agent call tool
		// registerA2aCallTool(server);
	}

	// Add more tool categories as needed
}
