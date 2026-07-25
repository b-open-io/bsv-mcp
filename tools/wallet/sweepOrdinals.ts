import type { OneSatContext } from "@1sat/actions";
import { sweepOrdinals } from "@1sat/actions";
import { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { assertBroadcastAllowed } from "../../utils/broadcastGuard";
import { redactKeyMaterial, redactUnknown } from "../../utils/redact";

const sweepInputSchema = z.object({
	outpoint: z.string().describe("Outpoint (txid_vout)"),
	satoshis: z.number().int().describe("Satoshis (should be 1)"),
	lockingScript: z.string().describe("Locking script hex"),
});

const sweepOrdinalsSchema = z.object({
	inputs: z.array(sweepInputSchema).describe("Ordinal UTXOs to sweep"),
	wif: z.string().describe("WIF private key controlling the inputs"),
});

export function registerSweepOrdinalsTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		"wallet_sweepOrdinals",
		"Sweep ordinals from an external WIF private key into the wallet",
		{ ...sweepOrdinalsSchema.shape },
		async ({ inputs, wif }) => {
			if (!ctx) {
				return {
					content: [
						{
							type: "text" as const,
							text: "BRC-100 wallet context not available",
						},
					],
					isError: true,
				};
			}

			try {
				assertBroadcastAllowed("wallet_sweepOrdinals");
				const key = PrivateKey.fromWif(wif);
				const result = await sweepOrdinals.execute(ctx, {
					inputs,
					keys: inputs.map(() => key),
				});

				if (result.error) {
					return {
						content: [
							{ type: "text" as const, text: redactKeyMaterial(result.error) },
						],
						isError: true,
					};
				}

				return {
					content: [
						{
							type: "text" as const,
							text: redactUnknown(result, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text" as const,
							text: redactKeyMaterial(
								error instanceof Error ? error.message : String(error),
							),
						},
					],
					isError: true,
				};
			}
		},
	);
}
