import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Wallet } from "./wallet";

/**
 * Register the tool to get the wallet address
 * @param server The MCP server instance
 * @param wallet The initialized custom Wallet instance
 */
export function registerGetAddressTool(
	server: McpServer,
	wallet: Wallet,
): void {
	server.tool(
		"wallet_getAddress",
		"Retrieves the current wallet's Bitcoin SV address. This address can be used to receive BSV, ordinals, or tokens, and is derived from the wallet's private key.",
		{
			args: z
				.object({})
				.optional()
				.describe(
					"No parameters required - simply returns the current wallet address",
				),
		},
		async () => {
			try {
				const address = wallet.getAddress();

				if (!address) {
					throw new Error(
						"Could not retrieve address from wallet instance. Key might be missing or getAddress method failed.",
					);
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ address, status: "ok" }),
						},
					],
				};
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								error: "Failed to get wallet address",
								message: msg,
								status: "error",
							}),
						},
					],
					isError: true,
				};
			}
		},
	);
}
