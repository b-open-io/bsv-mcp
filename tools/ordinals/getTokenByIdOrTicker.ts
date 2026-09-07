import type { OneSatServices } from "@1sat/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register the BSV21 token lookup tool
 */
export function registerGetTokenByIdOrTickerTool(
	server: McpServer,
	services: OneSatServices,
): void {
	server.tool(
		"ordinals_getTokenByIdOrTicker",
		"Retrieves detailed information about a BSV21 token by its ID (txid_vout format). Returns token data including symbol, supply, decimals, funding status, and current state.",
		{
			id: z.string().describe("BSV21 token ID in outpoint format (txid_vout)"),
		},
		async ({ id }) => {
			try {
				if (!services) {
					throw new Error("OneSat services not available");
				}

				if (!/^[0-9a-f]{64}[._]\d+$/i.test(id)) {
					throw new Error(
						"Invalid token ID format. Expected 'txid.vout' or 'txid_vout'",
					);
				}

				const data = await services.bsv21.getTokenDetails(id.replace("_", "."));

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(data, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: error instanceof Error ? error.message : String(error),
						},
					],
					isError: true,
				};
			}
		},
	);
}
