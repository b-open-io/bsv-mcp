import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { toBitcoin } from "satoshi-token";
import { z } from "zod";
import type { Wallet } from "./wallet";

const refreshUtxosArgsSchema = z.object({});
type RefreshUtxosArgs = z.infer<typeof refreshUtxosArgsSchema>;

/**
 * Registers the wallet_refreshUtxos tool that refreshes and returns the UTXOs for the wallet
 */
export function registerRefreshUtxosTool(server: McpServer, wallet: Wallet) {
	server.tool(
		"wallet_refreshUtxos",
		"Refreshes and returns the wallet's UTXOs. This is useful for debugging UTXO issues, ensuring the wallet has the latest transaction outputs, and for verifying available funds before making transactions.",
		{ args: refreshUtxosArgsSchema },
		async (
			{ args }: { args: RefreshUtxosArgs },
			_extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		) => {
			try {
				// Force refresh the UTXOs
				await wallet.refreshUtxos();

				// Get the refreshed UTXOs
				const { paymentUtxos, nftUtxos } = await wallet.getUtxos();

				// Calculate total satoshis in payment UTXOs
				const totalSatoshis = paymentUtxos.reduce(
					(sum, utxo) => sum + utxo.satoshis,
					0,
				);

				// Format the response
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									status: "success",
									paymentUtxos: paymentUtxos.map((utxo) => ({
										txid: utxo.txid,
										vout: utxo.vout,
										satoshis: utxo.satoshis,
										outpoint: `${utxo.txid}_${utxo.vout}`,
									})),
									nftUtxos: nftUtxos.map((utxo) => ({
										txid: utxo.txid,
										vout: utxo.vout,
										origin: utxo.origin,
										outpoint: `${utxo.txid}_${utxo.vout}`,
									})),
									totalPaymentUtxos: paymentUtxos.length,
									totalNftUtxos: nftUtxos.length,
									totalSatoshis: totalSatoshis,
									totalBsv: toBitcoin(totalSatoshis),
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
