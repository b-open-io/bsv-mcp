import type { OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { walletDepositAddress } from "../../utils/walletDepositAddress";

/**
 * Register the tool to get the wallet's BRC-29 deposit address
 */
export function registerGetAddressTool(
	server: McpServer,
	ctx?: OneSatContext,
): void {
	server.registerTool(
		"wallet_getAddress",
		{
			description:
				"Retrieves the wallet's BRC-29 deposit address derived for MCP. This address can receive BSV, ordinals, or tokens via external payments.",
			inputSchema: z.object({}),
		},
		async () => {
			try {
				if (!ctx) {
					throw new Error("BRC-100 wallet context not available");
				}

				const address = await walletDepositAddress(ctx);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								address,
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
