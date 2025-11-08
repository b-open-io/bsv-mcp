import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type { DropletClient } from "../../utils/droplet";
import { emptyArgsSchema } from "./schemas";

/**
 * Register the getBalance tool for Droplet API mode
 */
export function registerWalletGetBalanceDropletTool(
	server: McpServer,
	dropletClient: DropletClient,
) {
	server.tool(
		"wallet_getBalance",
		"Gets the current balance of the wallet (Droplet mode)",
		{
			args: emptyArgsSchema,
		},
		async (
			{ args }: { args: unknown },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		) => {
			try {
				const status = await dropletClient.getFaucetStatus();

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								balance: status.balance_satoshis,
								unspentUtxoCount: status.unspent_utxo_count,
								spendableUtxoCount: status.spendable_utxo_count,
								consolidatingBalance: status.consolidating_balance_satoshis,
								consolidatingUtxoCount: status.consolidating_utxo_count,
								fixedDropSats: status.fixed_drop_sats,
								faucetName: status.faucet_name,
							}),
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
