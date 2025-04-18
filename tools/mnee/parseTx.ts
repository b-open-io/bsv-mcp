import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
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
	server.tool(
		"mnee_parseTx",
		"Parse an MNEE transaction to get detailed information about its operations and amounts. All amounts are in atomic units with 5 decimal precision (e.g. 1000 atomic units = 0.01 MNEE).",
		{ args: parseTxArgsSchema },
		async (
			{ args }: { args: ParseTxArgs },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		): Promise<CallToolResult> => {
			try {
				const result: ParseTxResponse = await mnee.parseTx(args.txid);

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
