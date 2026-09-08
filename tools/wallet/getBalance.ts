import type { OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/server";
import { toBitcoin } from "satoshi-token";
import { z } from "zod";

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
				const seen = new Set<string>();
				let totalSatoshis = 0;
				let expectedCount: number | undefined;
				do {
					const result = await ctx.wallet.listOutputs({
						basket: "default",
						limit: 1000,
						offset: seen.size,
					});
					if (
						!Number.isSafeInteger(result.totalOutputs) ||
						result.totalOutputs < 0 ||
						result.totalOutputs > 100_000
					)
						throw new Error(
							"Wallet output count is invalid or exceeds the balance read limit.",
						);
					expectedCount ??= result.totalOutputs;
					if (
						result.totalOutputs !== expectedCount ||
						(!result.outputs.length && seen.size < expectedCount)
					)
						throw new Error(
							"Wallet outputs changed or a page was incomplete. Retry the balance read.",
						);
					for (const output of result.outputs) {
						if (
							!output.outpoint ||
							seen.has(output.outpoint) ||
							!Number.isSafeInteger(output.satoshis) ||
							output.satoshis < 0
						)
							throw new Error(
								"Wallet returned inconsistent outputs. Retry the balance read.",
							);
						seen.add(output.outpoint);
						totalSatoshis += output.satoshis;
					}
					if (seen.size > expectedCount || !Number.isSafeInteger(totalSatoshis))
						throw new Error("Wallet returned an inconsistent balance.");
				} while (seen.size < expectedCount);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								satoshis: totalSatoshis,
								bsv: toBitcoin(totalSatoshis),
								utxoCount: seen.size,
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
