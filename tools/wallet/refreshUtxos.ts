import { syncAddresses, type OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const MCP_ADDRESS_PREFIX = "mcp";

/**
 * Registers the wallet_refreshUtxos tool that syncs external payments
 * to BRC-29 deposit addresses into the BRC-100 wallet.
 */
export function registerRefreshUtxosTool(
	server: McpServer,
	ctx?: OneSatContext,
) {
	server.tool(
		"wallet_refreshUtxos",
		"Syncs external payments sent to BRC-29 deposit addresses into the wallet. Triggers lazy indexing on the server, classifies outputs (funding, ordinals, tokens), and internalizes them.",
		{},
		async () => {
			try {
				if (!ctx) {
					throw new Error("BRC-100 wallet context not available");
				}

				const result = await syncAddresses.execute(ctx, {
					prefix: MCP_ADDRESS_PREFIX,
					count: 1,
				});

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									status: "success",
									processed: result.processed,
									failed: result.failed,
									lastScore: result.lastScore,
									addresses: result.addresses,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);
}
