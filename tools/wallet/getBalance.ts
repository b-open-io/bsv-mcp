import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { toBitcoin } from "satoshi-token"; // For converting satoshis to BSV string
import { z } from "zod";
import type { Wallet } from "./wallet";

export const walletGetBalanceArgsSchema = z.object({}).optional();
export type WalletGetBalanceArgs = z.infer<typeof walletGetBalanceArgsSchema>;

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
		{ args: walletGetBalanceArgsSchema },
		async (
			args: WalletGetBalanceArgs, // Args are empty but present for schema consistency
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		) => {
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
