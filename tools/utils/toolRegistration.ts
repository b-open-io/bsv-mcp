/**
 * Common tool registration utilities for the BSV MCP server
 */
import type {
	CallToolResult,
	McpServer,
	ServerContext,
} from "@modelcontextprotocol/server";
import type { z } from "zod";

export interface ToolConfig<TArgs = Record<string, unknown>> {
	name: string;
	description: string;
	schema: z.ZodSchema<TArgs>;
	handler: (args: TArgs, ctx: ServerContext) => Promise<ToolResponse>;
}

export type ToolResponse = CallToolResult;

/**
 * Register a tool with standard error handling and response formatting
 */
export function registerTool<TArgs = Record<string, unknown>>(
	server: McpServer,
	config: ToolConfig<TArgs>,
): void {
	server.registerTool(
		config.name,
		{ description: config.description, inputSchema: config.schema },
		async (args, ctx: ServerContext) => {
			try {
				return await config.handler(args as TArgs, ctx);
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
		},
	);
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
