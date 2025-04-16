import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { convertData } from "./conversion";

const encodingSchema = z.enum(["utf8", "hex", "base64", "binary"]);

/**
 * Register the unified conversion tool with the MCP server
 * @param server The MCP server instance
 */
export function registerUtilsTools(server: McpServer): void {
	server.tool(
		"utils_convertData",
		{
			args: z.object({
				data: z.string(),
				from: encodingSchema,
				to: encodingSchema,
			}),
		},
		async ({ args }) => {
			try {
				const result = convertData({
					data: args.data,
					from: args.from,
					to: args.to,
				});
				return {
					content: [
						{
							type: "text",
							text: result,
						},
					],
				};
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return {
					content: [
						{
							type: "text",
							text: `Error: ${msg}`,
						},
					],
					isError: true,
				};
			}
		},
	);
}
