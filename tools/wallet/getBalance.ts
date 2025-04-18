import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { toBitcoin } from "satoshi-token";
import { z } from "zod";
import type { Wallet } from "./wallet";

/**
 * Schema for the getBalance tool arguments (empty object)
 */
export const getBalanceArgsSchema = z.object({});

export type GetBalanceArgs = z.infer<typeof getBalanceArgsSchema>;

/**
 * Register the wallet_getBalance tool for checking the BSV balance
 */
export function registerGetBalanceTool(
	server: McpServer,
	wallet: Wallet,
): void {
	const handler = async (
		{ args }: { args: GetBalanceArgs },
		extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
	) => {
		try {
			// Get the wallet's UTXOs
			const { paymentUtxos } = await wallet.getUtxos();

			// Calculate the total balance in satoshis
			const satoshis = paymentUtxos.reduce(
				(total, utxo) => total + utxo.satoshis,
				0,
			);

			// Convert satoshis to BSV
			const bsv = toBitcoin(satoshis);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								satoshis,
								bsv,
								bsvFormatted: bsv.toFixed(8),
							},
							null,
							2,
						),
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
	};

	server.tool(
		"wallet_getBalance",
		"Retrieves the current Bitcoin SV (BSV) balance for the wallet. Returns the balance in satoshis and BSV.",
		{ args: getBalanceArgsSchema },
		handler
	);
}

// Export the handler function directly so it can be used in tests
export const getBalanceHandler = (wallet: Wallet) => async (
	{ args }: { args: GetBalanceArgs },
	extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
) => {
	try {
		// Get the wallet's UTXOs
		const { paymentUtxos } = await wallet.getUtxos();

		// Calculate the total balance in satoshis
		const satoshis = paymentUtxos.reduce(
			(total, utxo) => total + utxo.satoshis,
			0,
		);

		// Convert satoshis to BSV
		const bsv = toBitcoin(satoshis);

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(
						{
							satoshis,
							bsv,
							bsvFormatted: bsv.toFixed(8),
						},
						null,
						2,
					),
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
};
