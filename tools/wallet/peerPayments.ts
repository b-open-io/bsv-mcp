import type { OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
	createPeerPaymentReceiver,
	PEER_PAYMENT_MESSAGEBOX_HOST,
} from "../../utils/peerPaymentReceive";

const inputSchema = z.object({
	operation: z.enum(["list", "receive"]),
	messageId: z.string().trim().min(1).max(256).optional(),
});

/** Register embedded-wallet PeerPay listing and explicit receive. */
export function registerPeerPaymentsTool(
	server: McpServer,
	ctx: OneSatContext,
	host = PEER_PAYMENT_MESSAGEBOX_HOST,
	externalWallet = false,
): void {
	if (externalWallet) return;
	server.registerTool(
		"wallet_peerPayments",
		{
			description:
				"Lists pending PeerPay payments or receives one selected payment into the embedded BRC-100 wallet. Receiving requires an explicit messageId and internalizes funds before acknowledging the MessageBox item.",
			inputSchema,
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: true,
			},
		},
		async (input) => {
			try {
				const args = inputSchema.parse(input);
				const receiver = createPeerPaymentReceiver(ctx.wallet, { host });
				const pending = await receiver.listPendingPayments();
				if (args.operation === "list") {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										status: "success",
										count: pending.length,
										payments: pending.map((payment) => ({
											messageId: payment.messageId,
											sender: payment.sender,
											amount: payment.token.amount,
										})),
									},
									null,
									2,
								),
							},
						],
					};
				}
				if (args.messageId === undefined)
					throw new Error("messageId is required for receive");
				const payment = pending.find(
					({ messageId }) => messageId === args.messageId,
				);
				if (payment === undefined)
					throw new Error(
						"Selected payment is no longer pending; refresh and retry",
					);
				await receiver.receivePayment(payment);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								status: "received",
								messageId: payment.messageId,
								sender: payment.sender,
								amount: payment.token.amount,
							}),
						},
					],
				};
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				return { content: [{ type: "text", text: message }], isError: true };
			}
		},
	);
}
