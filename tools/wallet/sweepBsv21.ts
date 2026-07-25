import type { OneSatContext } from "@1sat/actions";
import { sweepBsv21 } from "@1sat/actions";
import { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { assertBroadcastAllowed } from "../../utils/broadcastGuard";
import { redactKeyMaterial, redactUnknown } from "../../utils/redact";

const sweepBsv21InputSchema = z.object({
	outpoint: z.string().describe("Outpoint (txid_vout)"),
	satoshis: z.number().int().describe("Satoshis (should be 1)"),
	lockingScript: z.string().describe("Locking script hex"),
	tokenId: z.string().describe("Token ID (txid_vout format)"),
	amount: z.string().describe("Token amount as string"),
});

const sweepBsv21Schema = z.object({
	inputs: z
		.array(sweepBsv21InputSchema)
		.describe("Token UTXOs to sweep (must all be same tokenId)"),
	wif: z.string().describe("WIF private key controlling the inputs"),
});

export function registerSweepBsv21Tool(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	server.tool(
		"wallet_sweepBsv21",
		"Sweep BSV21 tokens from an external WIF private key into the wallet",
		{ ...sweepBsv21Schema.shape },
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
				assertBroadcastAllowed("wallet_sweepBsv21");
				const key = PrivateKey.fromWif(wif);
				const result = await sweepBsv21.execute(ctx, {
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
