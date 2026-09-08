import { deriveDepositAddresses, type OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
	EMBEDDED_OWNER_ORIGINATOR,
	withEmbeddedOwnerDerivation,
} from "../../utils/embeddedOwnerRead";

const MCP_ADDRESS_PREFIX = "mcp";

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

				const ownerOriginator = (
					ctx as OneSatContext & {
						[EMBEDDED_OWNER_ORIGINATOR]?: string;
					}
				)[EMBEDDED_OWNER_ORIGINATOR];
				const deriveContext = ownerOriginator
					? {
							...ctx,
							wallet: withEmbeddedOwnerDerivation(ctx.wallet, ownerOriginator),
						}
					: ctx;

				const { derivations } = await deriveDepositAddresses.execute(
					deriveContext,
					{
						prefix: MCP_ADDRESS_PREFIX,
					},
				);

				const firstDerivation = derivations[0];
				if (!firstDerivation) throw new Error("No deposit address was derived");

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								address: firstDerivation.address,
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
