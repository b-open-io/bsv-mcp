import { describe, expect, it, mock, spyOn } from "bun:test";
import { type PeerMessage, PeerPayClient } from "@bsv/message-box-client";
import {
	AuthFetch,
	Brc29RemittanceModule,
	type WalletInterface,
} from "@bsv/sdk";
import {
	createPeerPaymentReceiver,
	createPeerPayServicePaymentDeniedWallet,
	finalizePeerPaymentReceive,
	listPendingPeerPayments,
	PEER_PAYMENT_MESSAGEBOX_HOST,
	PEER_PAYMENT_SERVICE_PAYMENT_REQUIRED,
} from "./peerPaymentReceive";

const sender = "02".padEnd(66, "1");
const token = {
	amount: 10_000,
	transaction: [1, 2, 3],
	customInstructions: { derivationPrefix: "c", derivationSuffix: "s" },
};

describe("PeerPay receive adapter", () => {
	it("parses only valid payment tokens from lite, read-only messages", async () => {
		let received: { messageBox: string; host: string } | undefined;
		const client = {
			listMessagesLite: async (params: {
				messageBox: string;
				host: string;
			}) => {
				received = params;
				return [
					{ messageId: "message-1", sender, body: token },
					{ messageId: "malformed", sender, body: { amount: 1 } },
				] as unknown as PeerMessage[];
			},
		};

		const result = await listPendingPeerPayments(
			client,
			"https://messagebox.example",
		);
		expect(received).toEqual({
			messageBox: "payment_inbox",
			host: "https://messagebox.example",
		});
		expect(result).toHaveLength(1);
		expect(result[0]?.messageId).toBe("message-1");
	});

	it("constructs the real SDK client without network activity", () => {
		const receiver = createPeerPaymentReceiver({} as WalletInterface);
		expect(receiver.listPendingPayments).toBeFunction();
		expect(PEER_PAYMENT_MESSAGEBOX_HOST).toBe("https://messagebox.1sat.app");
	});

	it("does not acknowledge an explicit wallet rejection", async () => {
		let acknowledged = false;
		await expect(
			finalizePeerPaymentReceive(
				{ paymentResult: { accepted: false } },
				"message-1",
				async () => {
					acknowledged = true;
				},
			),
		).rejects.toThrow("explicitly rejected");
		expect(acknowledged).toBe(false);
	});

	it("acknowledges only after explicit acceptance", async () => {
		let acknowledged = false;
		const result = await finalizePeerPaymentReceive(
			{ paymentResult: { accepted: true } },
			"message-1",
			async () => {
				acknowledged = true;
			},
		);
		expect(result).toEqual({ paymentResult: { accepted: true } });
		expect(acknowledged).toBe(true);
	});

	it("reports ambiguous SDK failure without recommending a blind retry", async () => {
		await expect(
			finalizePeerPaymentReceive(
				"Unable to receive payment!",
				"message-1",
				async () => {},
			),
		).rejects.toThrow("outcome is uncertain");
	});

	it("treats missing or malformed acceptance as ambiguous", async () => {
		for (const result of [undefined, {}, { paymentResult: {} }]) {
			await expect(
				finalizePeerPaymentReceive(result, "message-1", async () => {}),
			).rejects.toThrow("result is ambiguous");
		}
	});

	it("reports acknowledgment failure as already internalized", async () => {
		await expect(
			finalizePeerPaymentReceive(
				{ paymentResult: { accepted: true } },
				"message-1",
				async () => {
					throw new Error("network timeout");
				},
			),
		).rejects.toThrow("was internalized");
	});

	it("rejects malformed transaction bytes and empty derivation metadata", async () => {
		const client = {
			listMessagesLite: async () =>
				[
					{
						messageId: "bad-byte",
						sender,
						body: { ...token, transaction: [1, 256] },
					},
					{
						messageId: "empty-prefix",
						sender,
						body: {
							...token,
							customInstructions: {
								derivationPrefix: " ",
								derivationSuffix: "s",
							},
						},
					},
				] as unknown as PeerMessage[],
		};
		expect(
			await listPendingPeerPayments(client, "https://messagebox.example"),
		).toEqual([]);
	});

	it("denies automatic service spending while delegating explicit internalization", async () => {
		const underlying = {
			createAction: mock(async () => ({ tx: [1] })),
			signAction: mock(async () => ({})),
			internalizeAction: mock(async () => ({ accepted: true })),
		} as unknown as WalletInterface;
		const facade = createPeerPayServicePaymentDeniedWallet(underlying);

		await expect(facade.createAction({} as never)).rejects.toThrow(
			"service-payment-required",
		);
		await expect(facade.signAction({} as never)).rejects.toThrow(
			"service-payment-required",
		);
		await expect(facade.createAction({} as never)).rejects.toThrow(
			PEER_PAYMENT_SERVICE_PAYMENT_REQUIRED,
		);
		expect(underlying.createAction).not.toHaveBeenCalled();
		expect(underlying.signAction).not.toHaveBeenCalled();

		await expect(facade.internalizeAction({} as never)).resolves.toEqual({
			accepted: true,
		});
		expect(underlying.internalizeAction).toHaveBeenCalledTimes(1);
	});

	it("real SDK 402 payment processor cannot spend through the PeerPay facade", async () => {
		const publicKey =
			"0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
		const underlying = {
			getPublicKey: mock(async () => ({ publicKey })),
			createHmac: mock(async () => ({ hmac: Array(32).fill(7) })),
			createAction: mock(async () => ({ tx: [1] })),
			signAction: mock(async () => ({})),
		} as unknown as WalletInterface;
		const facade = createPeerPayServicePaymentDeniedWallet(underlying);
		// Invoke the installed SDK payment processor unchanged, as its own
		// payment tests do. A fetch mock alone would miss SDK auto-payment.
		const sdk = new AuthFetch(facade);
		const processPayment = Reflect.get(sdk, "handlePaymentAndRetry") as (
			url: string,
			init: object,
			response: Response,
		) => Promise<Response>;
		const response = new Response(null, {
			status: 402,
			headers: {
				"x-bsv-payment-version": "1.0",
				"x-bsv-payment-satoshis-required": "5",
				"x-bsv-auth-identity-key": publicKey,
				"x-bsv-payment-derivation-prefix": "test-prefix",
			},
		});
		await expect(
			processPayment.call(
				sdk,
				"https://messagebox.1sat.app",
				{ method: "POST", paymentRetryAttempts: 0 },
				response,
			),
		).rejects.toThrow("service-payment-required");
		expect(underlying.createAction).not.toHaveBeenCalled();
		expect(underlying.signAction).not.toHaveBeenCalled();
		expect(underlying.getPublicKey).toHaveBeenCalled();
	});
});

it("real SDK acceptance dispatch defers acknowledgment until explicit acceptance", async () => {
	const settlement = spyOn(Brc29RemittanceModule.prototype, "acceptSettlement");
	const acknowledge = spyOn(
		PeerPayClient.prototype,
		"acknowledgeMessage",
	).mockResolvedValue("success");
	try {
		const receiver = createPeerPaymentReceiver({} as WalletInterface);
		const payment = { messageId: "sdk-ack-test", sender, token };
		settlement.mockResolvedValue({
			action: "accept",
			receiptData: { internalizeResult: { accepted: false } },
		});
		await expect(receiver.receivePayment(payment)).rejects.toThrow(
			"explicitly rejected",
		);
		expect(acknowledge).not.toHaveBeenCalled();
		settlement.mockResolvedValue({
			action: "accept",
			receiptData: { internalizeResult: { accepted: true } },
		});
		await receiver.receivePayment(payment);
		expect(acknowledge).toHaveBeenCalledTimes(1);
		expect(acknowledge).toHaveBeenCalledWith({
			messageIds: [payment.messageId],
			host: PEER_PAYMENT_MESSAGEBOX_HOST,
		});
	} finally {
		settlement.mockRestore();
		acknowledge.mockRestore();
	}
});
