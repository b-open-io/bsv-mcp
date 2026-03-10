import {
	deriveDepositAddresses,
	type OneSatContext,
} from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const MCP_ADDRESS_PREFIX = "mcp";

/**
 * Register the tool to get the wallet's BRC-29 deposit address
 */
export function registerGetAddressTool(
	server: McpServer,
	ctx?: OneSatContext,
): void {
	server.tool(
		"wallet_getAddress",
		"Retrieves the wallet's BRC-29 deposit address derived for MCP. This address can receive BSV, ordinals, or tokens via external payments.",
		{},
		async () => {
			try {
				if (!ctx) {
					throw new Error("BRC-100 wallet context not available");
				}

				const { derivations } = await deriveDepositAddresses.execute(ctx, {
					prefix: MCP_ADDRESS_PREFIX,
				});

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								address: derivations[0].address,
								status: "ok",
							}),
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
