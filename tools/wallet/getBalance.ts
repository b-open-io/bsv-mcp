import type { OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/server";
import { toBitcoin } from "satoshi-token";
import { z } from "zod";
import { readWalletBalance } from "../../utils/walletBalance";

export function registerWalletGetBalanceTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.registerTool(
		"wallet_getBalance",
		{
			description: "Retrieves the current BSV balance for the wallet.",
			inputSchema: z.object({}),
		},
		async () => {
			if (!ctx) {
				return {
					content: [
						{
							type: "text",
							text: "Wallet not initialized. Please configure a wallet before checking balance.",
						},
					],
					isError: true,
				};
			}

			try {
				const balance = await readWalletBalance(ctx);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								satoshis: balance.satoshis,
								bsv: toBitcoin(balance.satoshis),
								utxoCount: balance.utxoCount,
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
