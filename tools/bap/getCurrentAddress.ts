import { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Wallet } from "../wallet/wallet";

/**
 * Register the tool to get the BAP identity address
 * @param server The MCP server instance
 * @param identityPk The optional identity private key
 */
export function registerBapGetCurrentAddressTool(
	server: McpServer,
	identityPk?: PrivateKey,
): void {
	server.tool(
		"bap_getCurrentAddress",
		"Retrieves the current BAP identity's Bitcoin SV address. This address is derived from the server's configured identity key.",
		{
			args: z
				.object({}) // No arguments needed
				.optional()
				.describe(
					"No parameters required - simply returns the current BAP identity address",
				),
		},
		async () => {
			try {
				let pkToUse = identityPk;

				// Fallback to environment variable if identityPk wasn't provided
				if (!pkToUse) {
					const identityKeyWifEnv = process.env.IDENTITY_KEY_WIF;
					if (identityKeyWifEnv) {
						try {
							pkToUse = PrivateKey.fromWif(identityKeyWifEnv);
						} catch (e) {
							// Let the final check handle the error
						}
					}
				}

				if (!pkToUse) {
					throw new Error(
						"Could not retrieve BAP identity address. Identity key not configured.",
					);
				}

				const address = pkToUse.toAddress().toString();

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
								error: "Failed to get BAP identity address",
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
