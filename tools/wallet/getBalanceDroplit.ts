import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { DroplitClient } from "../../utils/droplit";

/**
 * Register the getBalance tool for Droplit API mode
 */
export function registerWalletGetBalanceDroplitTool(
	server: McpServer,
	droplitClient: DroplitClient,
) {
	server.registerTool(
		"wallet_getBalance",
		{
			description: "Gets the current balance of the wallet (Droplit mode)",
			inputSchema: z.object({}),
		},
		async () => {
			try {
				const status = await droplitClient.getFaucetStatus();

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
