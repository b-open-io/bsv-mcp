import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type Mnee from "mnee";
import type { SendMNEE, TransferResponse } from "mnee";
import { z } from "zod";
import { assertBroadcastAllowed } from "../../utils/broadcastGuard";

/**
 * Schema for the sendMnee tool arguments.
 */
export const sendMneeArgsSchema = z.object({
	address: z.string().min(1).describe("The recipient's address"),
	amount: z
		.number()
		.positive()
		.finite()
		.describe("Amount to send; must be greater than zero"),
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
		{ ...sendMneeArgsSchema.shape },
		async (
			{ address, amount, currency },
			_extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		): Promise<CallToolResult> => {
			try {
				assertBroadcastAllowed("mnee_sendMnee");
				// MNEE is dollar-pegged, so a USD amount transfers one-for-one. The
				// currency the caller named is echoed in the response rather than
				// dropped, so the interpretation is visible to whoever called.
				const mneeAmount = amount;

				const transferRequest: SendMNEE[] = [
					{
						address,
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

				// transfer() throws on failure. On success it returns the cosigner's
				// broadcast ticket id — the txid is only known once the ticket
				// resolves, so it is read back via getTxStatus.
				const result: TransferResponse = await mnee.transfer(
					transferRequest,
					wif,
				);

				if (!result.ticketId) {
					throw new Error(
						"MNEE transfer returned no ticket id; the transaction was not submitted for broadcast.",
					);
				}

				const status = await mnee.getTxStatus(result.ticketId);
				if (status.status === "FAILED") {
					throw new Error(
						`MNEE transfer ${result.ticketId} failed: ${status.errors ?? "no error detail returned"}`,
					);
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									ticketId: result.ticketId,
									txid: status.tx_id,
									status: status.status,
									requestedCurrency: currency,
									mneeAmount: mneeAmount,
									usdAmount: formatUSD(mneeAmount),
									recipient: address,
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
