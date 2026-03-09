import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toBitcoin } from "satoshi-token"; // For converting satoshis to BSV string
import type { Wallet } from "./wallet";

/**
 * Registers the wallet_getBalance tool
 */
export function registerWalletGetBalanceTool(
	server: McpServer,
	wallet: Wallet,
) {
	server.tool(
		"wallet_getBalance",
		"Retrieves the current BSV balance for the wallet based on its UTXOs.",
		{},
		async () => {
			try {
				const { paymentUtxos } = await wallet.getUtxos();

				let totalSatoshis = 0;
				if (paymentUtxos && paymentUtxos.length > 0) {
					for (const utxo of paymentUtxos) {
						totalSatoshis += utxo.satoshis || 0;
					}
				}

				const bsvAmount = toBitcoin(totalSatoshis); // Convert to BSV string

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								satoshis: totalSatoshis,
								bsv: bsvAmount,
								utxoCount: paymentUtxos ? paymentUtxos.length : 0,
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
