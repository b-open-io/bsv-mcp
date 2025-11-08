import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { convertData } from "./conversion";
import { installAgentMasterTool } from "./installAgentMaster";

const encodingSchema = z.enum(["utf8", "hex", "base64", "binary"]);

/**
 * Register utility tools with the MCP server
 * @param server The MCP server instance
 */
export function registerUtilsTools(server: McpServer): void {
	// Register install agent master tool
	server.tool(
		installAgentMasterTool.name,
		installAgentMasterTool.description,
		{ args: installAgentMasterTool.inputSchema },
		async ({ args }) => {
			try {
				const result = await installAgentMasterTool.handler(args);
				return {
					content: [
						{
							type: "text",
							text:
								typeof result === "string"
									? result
									: JSON.stringify(result, null, 2),
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

	// Register conversion tool
	server.tool(
		"utils_convertData",
		"Converts data between different encodings (utf8, hex, base64, binary). Useful for transforming data formats when working with blockchain data, encryption, or file processing.\n\n" +
			"Parameters:\n" +
			"- data (required): The string to convert\n" +
			"- from (required): Source encoding format (utf8, hex, base64, or binary)\n" +
			"- to (required): Target encoding format (utf8, hex, base64, or binary)\n\n" +
			"Example usage:\n" +
			'- UTF-8 to hex: {"data": "hello world", "from": "utf8", "to": "hex"} → 68656c6c6f20776f726c64\n' +
			'- UTF-8 to base64: {"data": "Hello World", "from": "utf8", "to": "base64"} → SGVsbG8gV29ybGQ=\n' +
			'- base64 to UTF-8: {"data": "SGVsbG8gV29ybGQ=", "from": "base64", "to": "utf8"} → Hello World\n' +
			'- hex to base64: {"data": "68656c6c6f20776f726c64", "from": "hex", "to": "base64"} → aGVsbG8gd29ybGQ=\n\n' +
			"Notes:\n" +
			"- All parameters are required\n" +
			"- The tool returns the converted data as a string\n" +
			"- For binary conversion, data is represented as an array of byte values",
		{
			args: z.object({
				data: z.string().describe("The data string to be converted"),
				from: encodingSchema.describe(
					"Source encoding format (utf8, hex, base64, or binary)",
				),
				to: encodingSchema.describe(
					"Target encoding format to convert to (utf8, hex, base64, or binary)",
				),
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

// Export all utilities for use by other tools
export * from "./errorHandler";
export * from "./transactionBuilder";
export * from "./toolRegistration";
export * from "./toolConfig";
export * from "./logger";
export * from "./aip";
