/**
 * Common tool registration utilities for the BSV MCP server
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";

export interface ToolConfig<TArgs = Record<string, unknown>> {
	name: string;
	description: string;
	schema: z.ZodSchema<TArgs>;
	handler: (args: TArgs) => Promise<ToolResponse>;
}

export interface ToolResponse {
	content: Array<{
		type: "text";
		text: string;
	}>;
	isError?: boolean;
}

/**
 * Register a tool with standard error handling and response formatting
 */
export function registerTool<TArgs = Record<string, unknown>>(
	server: McpServer,
	config: ToolConfig<TArgs>,
): void {
	server.tool(config.name, config.schema, async (args: TArgs) => {
		try {
			return await config.handler(args);
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	});
}

/**
 * Helper function to create a simple tool registration function
 */
export function createToolRegistration<TDeps = undefined>(
	toolName: string,
	description: string,
	schema: z.ZodSchema<Record<string, unknown>>,
	handler: (
		args: Record<string, unknown>,
		deps?: TDeps,
	) => Promise<ToolResponse>,
) {
	return (server: McpServer, deps?: TDeps) => {
		registerTool(server, {
			name: toolName,
			description,
			schema,
			handler: (args) => handler(args, deps),
		});
	};
}
