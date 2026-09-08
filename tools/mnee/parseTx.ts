import type {
	CallToolResult,
	McpServer,
	ServerContext,
} from "@modelcontextprotocol/server";
import type { MneeInterface, ParseTxResponse } from "mnee";
import { z } from "zod";

/**
 * Schema for the parseTx tool arguments.
 */
export const parseTxArgsSchema = z.object({
	txid: z.string().describe("Transaction ID to parse"),
});

export type ParseTxArgs = z.infer<typeof parseTxArgsSchema>;

export function registerParseTxTool(
	server: McpServer,
	mnee: MneeInterface,
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
