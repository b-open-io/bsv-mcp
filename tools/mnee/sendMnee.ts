import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type Mnee from "mnee";
import type { SendMNEE, TransferResponse } from "mnee";
import { z } from "zod";

/**
 * Schema for the sendMnee tool arguments.
 */
export const sendMneeArgsSchema = z.object({
	address: z.string().describe("The recipient's address"),
	amount: z.number().describe("Amount to send"),
	currency: z
		.enum(["MNEE", "USD"])
		.default("MNEE")
		.describe("Currency of the amount (MNEE or USD)"),
});

export type SendMneeArgs = z.infer<typeof sendMneeArgsSchema>;

/**
 * Format a number as USD
 */
function formatUSD(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

/**
 * Registers the mnee_sendMnee tool for sending MNEE tokens
 */
export function registerSendMneeTool(server: McpServer, mnee: Mnee): void {
	server.tool(
		"mnee_sendMnee",
		"Send MNEE tokens to a specified address",
		{ args: sendMneeArgsSchema },
		async (
			{ args }: { args: SendMneeArgs },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		): Promise<CallToolResult> => {
			try {
				// Since 1 MNEE = $1, the amount is the same in both currencies
				const mneeAmount = args.amount;

				const transferRequest: SendMNEE[] = [
					{
						address: args.address,
						amount: mneeAmount,
					},
				];

				// Get WIF from environment
				const wif = process.env.PRIVATE_KEY_WIF;
				if (!wif) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										success: false,
										error: "No private key available",
										message:
											"Please set PRIVATE_KEY_WIF environment variable with a valid Bitcoin SV private key in WIF format.",
									},
									null,
									2,
								),
							},
						],
						isError: true,
					};
				}

				const result: TransferResponse = await mnee.transfer(
					transferRequest,
					wif,
				);

				if (result.error) {
					throw new Error(result.error);
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									txid: result.txid,
									rawtx: result.rawtx,
									mneeAmount: mneeAmount,
									usdAmount: formatUSD(mneeAmount),
									recipient: args.address,
								},
								null,
								2,
							),
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
