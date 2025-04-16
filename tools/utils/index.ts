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
		"Converts data between different encodings (utf8, hex, base64, binary). Useful for transforming data formats when working with blockchain data, encryption, or file processing.",
		{
			args: z.object({
				data: z.string().describe("The data string to be converted"),
				from: encodingSchema.describe("Source encoding format (utf8, hex, base64, or binary)"),
				to: encodingSchema.describe("Target encoding format to convert to (utf8, hex, base64, or binary)"),
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
