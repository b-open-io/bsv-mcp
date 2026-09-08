import type {
	CallToolResult,
	McpServer,
	ServerContext,
} from "@modelcontextprotocol/server";
import type { ParseTxResponse } from "mnee";
import { z } from "zod";
import { type MneeClientSource, resolveMneeClient } from "./provider";

/**
 * Schema for the parseTx tool arguments.
 */
export const parseTxArgsSchema = z.object({
	txid: z.string().describe("Transaction ID to parse"),
});

export type ParseTxArgs = z.infer<typeof parseTxArgsSchema>;

export function registerParseTxTool(
	server: McpServer,
	getMnee: MneeClientSource,
): void {
	server.registerTool(
		"mnee_parseTx",
		{
			description:
				"Parse an MNEE transaction to get detailed information about its operations and amounts. All amounts are in atomic units with 5 decimal precision (e.g. 1000 atomic units = 0.01 MNEE).",
			inputSchema: parseTxArgsSchema,
		},
		async ({ txid }, _extra: ServerContext): Promise<CallToolResult> => {
			try {
				const mnee = await resolveMneeClient(getMnee);
				const result: ParseTxResponse = await mnee.parseTx(txid);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);
}
