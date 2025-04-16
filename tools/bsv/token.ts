import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	ReturnTypes,
	toBitcoin,
	toSatoshi,
	toToken,
	toTokenSat,
} from "satoshi-token";
import { z } from "zod";

/**
 * Register token conversion tools for BSV
 * @param server The MCP server instance
 */
export function registerTokenTools(server: McpServer): void {
	// Convert Bitcoin to Satoshis
	server.tool(
		"bsv_toSatoshi",
		{
			args: z.object({
				bitcoin: z.union([z.number(), z.string()]),
				returnType: z.enum(["number", "string", "bigint"]).optional(),
			}),
		},
		async ({ args }) => {
			try {
				const { bitcoin, returnType } = args;
				let result: number | string | bigint;

				switch (returnType) {
					case "bigint":
						result = toSatoshi(bitcoin, ReturnTypes.BigInt);
						return { content: [{ type: "text", text: result.toString() }] };
					case "string":
						result = toSatoshi(bitcoin, ReturnTypes.String);
						return { content: [{ type: "text", text: result }] };
					default:
						result = toSatoshi(bitcoin);
						return { content: [{ type: "text", text: result.toString() }] };
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);

	// Convert Satoshis to Bitcoin
	server.tool(
		"bsv_toBitcoin",
		{
			args: z.object({
				satoshis: z.union([z.number(), z.string(), z.bigint()]),
				returnType: z.enum(["number", "string", "bigint"]).optional(),
			}),
		},
		async ({ args }) => {
			try {
				const { satoshis, returnType } = args;
				let result: number | string | bigint;

				switch (returnType) {
					case "bigint":
						try {
							result = toBitcoin(satoshis, ReturnTypes.BigInt);
							return { content: [{ type: "text", text: result.toString() }] };
						} catch (e) {
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot return Bitcoin amount as BigInt if it has decimal part",
									},
								],
								isError: true,
							};
						}
					case "string":
						result = toBitcoin(satoshis, ReturnTypes.String);
						return { content: [{ type: "text", text: result }] };
					default:
						result = toBitcoin(satoshis);
						return { content: [{ type: "text", text: result.toString() }] };
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);

	// Generic token conversion (for tokens with custom decimal places)
	server.tool(
		"bsv_toTokenSatoshi",
		{
			args: z.object({
				token: z.union([z.number(), z.string(), z.bigint()]),
				decimals: z.number().int().min(0),
				returnType: z.enum(["number", "string", "bigint"]).optional(),
			}),
		},
		async ({ args }) => {
			try {
				const { token, decimals, returnType } = args;
				let result: number | string | bigint;

				switch (returnType) {
					case "bigint":
						result = toTokenSat(token, decimals, ReturnTypes.BigInt);
						return { content: [{ type: "text", text: result.toString() }] };
					case "string":
						result = toTokenSat(token, decimals, ReturnTypes.String);
						return { content: [{ type: "text", text: result }] };
					default:
						result = toTokenSat(token, decimals);
						return { content: [{ type: "text", text: result.toString() }] };
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);

	// Generic token conversion (for tokens with custom decimal places)
	server.tool(
		"bsv_toToken",
		{
			args: z.object({
				tokenSatoshi: z.union([z.number(), z.string(), z.bigint()]),
				decimals: z.number().int().min(0),
				returnType: z.enum(["number", "string", "bigint"]).optional(),
			}),
		},
		async ({ args }) => {
			try {
				const { tokenSatoshi, decimals, returnType } = args;
				let result: number | string | bigint;

				switch (returnType) {
					case "bigint":
						try {
							result = toToken(tokenSatoshi, decimals, ReturnTypes.BigInt);
							return { content: [{ type: "text", text: result.toString() }] };
						} catch (e) {
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot return token amount as BigInt if it has decimal part",
									},
								],
								isError: true,
							};
						}
					case "string":
						result = toToken(tokenSatoshi, decimals, ReturnTypes.String);
						return { content: [{ type: "text", text: result }] };
					default:
						result = toToken(tokenSatoshi, decimals);
						return { content: [{ type: "text", text: result.toString() }] };
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);
}
