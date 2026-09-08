import {
	type IncomingPayment,
	type PeerMessage,
	PeerPayClient,
	type PeerPayClientConfig,
} from "@bsv/message-box-client";
import type { WalletInterface } from "@bsv/sdk";

export const PEER_PAYMENT_MESSAGEBOX_HOST = "https://messagebox.1sat.app";
const PAYMENT_MESSAGEBOX = "payment_inbox";

/**
 * Stable denial for automatic message-box service payments. The SDK
 * AuthFetch handles HTTP 402 by calling wallet.createAction; list/receive
 * must never buy service credits, so the facade below throws this instead
 * of spending. Explicit payment internalization still delegates to the
 * underlying wallet's internalizeAction.
 */
export const PEER_PAYMENT_SERVICE_PAYMENT_REQUIRED =
	"service-payment-required: PeerPay message-box service payments are disabled; list/receive must not buy service credits";

function peerPaymentServicePaymentDenied(): Promise<never> {
	return Promise.reject(new Error(PEER_PAYMENT_SERVICE_PAYMENT_REQUIRED));
}

/**
 * Narrow wallet facade for the PeerPay client. Denies spending actions the
 * SDK payment processor would otherwise invoke automatically on HTTP 402,
 * binds every other method to the original wallet, and permits the explicit
 * internalizeAction receive path. No key extraction or alternate signer.
 */
export function createPeerPayServicePaymentDeniedWallet(
	wallet: WalletInterface,
): WalletInterface {
	return new Proxy(wallet, {
		get(target, property, receiver) {
			if (property === "createAction" || property === "signAction") {
				return peerPaymentServicePaymentDenied;
			}
			const value = Reflect.get(target, property, receiver);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
}

export interface PeerPaymentReceiverOptions {
	host?: string;
	messageBox?: string;
	originator?: PeerPayClientConfig["originator"];
}

function isPaymentToken(value: unknown): value is IncomingPayment["token"] {
	if (value == null || typeof value !== "object") return false;
	const token = value as Record<string, unknown>;
	const instructions = token.customInstructions;
	const amount = token.amount;
	const prefix =
		instructions != null && typeof instructions === "object"
			? (instructions as Record<string, unknown>).derivationPrefix
			: undefined;
	const suffix =
		instructions != null && typeof instructions === "object"
			? (instructions as Record<string, unknown>).derivationSuffix
			: undefined;
	return (
		Number.isSafeInteger(token.amount) &&
		typeof amount === "number" &&
		amount > 0 &&
		Array.isArray(token.transaction) &&
		token.transaction.length > 0 &&
		token.transaction.every(
			(byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255,
		) &&
		instructions != null &&
		typeof instructions === "object" &&
		typeof prefix === "string" &&
		prefix.trim() !== "" &&
		typeof suffix === "string" &&
		suffix.trim() !== ""
	);
}

function toIncomingPayment(message: PeerMessage): IncomingPayment | undefined {
	if (
		typeof message.messageId !== "string" ||
		typeof message.sender !== "string"
	)
		return undefined;
	return isPaymentToken(message.body)
		? {
				messageId: message.messageId,
				sender: message.sender,
				token: message.body,
			}
		: undefined;
}

export interface PeerPaymentListClient {
	listMessagesLite(params: {
		messageBox: string;
		host: string;
	}): Promise<PeerMessage[]>;
}

export async function listPendingPeerPayments(
	client: PeerPaymentListClient,
	host: string,
	messageBox = PAYMENT_MESSAGEBOX,
): Promise<IncomingPayment[]> {
	const messages = await client.listMessagesLite({ messageBox, host });
	return messages
		.map(toIncomingPayment)
		.filter((payment): payment is IncomingPayment => payment !== undefined);
}

/** Prevents SDK acceptPayment from acknowledging before accepted is confirmed. */
class StrictPeerPayClient extends PeerPayClient {
	async acknowledgeMessage(params: {
		messageIds: string[];
		host?: string;
	}): Promise<string> {
		void params;
		return "deferred";
	}

	async acceptPaymentStrict(
		payment: IncomingPayment,
		host: string,
	): Promise<unknown> {
		const result = await super.acceptPayment(payment);
		return finalizePeerPaymentReceive(result, payment.messageId, () =>
			super.acknowledgeMessage({
				messageIds: [payment.messageId],
				host,
			}),
		);
	}
}

export async function finalizePeerPaymentReceive(
	result: unknown,
	messageId: string,
	acknowledge: () => Promise<unknown>,
): Promise<unknown> {
	if (result === "Unable to receive payment!") {
		throw new Error(
			`PeerPay payment outcome is uncertain for ${messageId}; do not re-internalize or retry blindly`,
		);
	}
	const paymentResult =
		result != null && typeof result === "object" && "paymentResult" in result
			? (result as { paymentResult?: unknown }).paymentResult
			: undefined;
	if (
		paymentResult != null &&
		typeof paymentResult === "object" &&
		(paymentResult as { accepted?: unknown }).accepted === false
	) {
		throw new Error(
			"PeerPay wallet explicitly rejected the payment; no acknowledgment was sent",
		);
	}
	if (
		paymentResult == null ||
		typeof paymentResult !== "object" ||
		(paymentResult as { accepted?: unknown }).accepted !== true
	) {
		throw new Error(
			`PeerPay payment result is ambiguous for ${messageId}; do not re-internalize or retry blindly`,
		);
	}
	try {
		await acknowledge();
	} catch (error) {
		throw new Error(
			`PeerPay payment ${messageId} was internalized, but acknowledgment is uncertain; do not re-internalize`,
			{ cause: error },
		);
	}
	return result;
}

export interface PeerPaymentReceiver {
	listPendingPayments(): Promise<IncomingPayment[]>;
	receivePayment(payment: IncomingPayment): Promise<unknown>;
}

export function createPeerPaymentReceiver(
	wallet: WalletInterface,
	options: PeerPaymentReceiverOptions = {},
): PeerPaymentReceiver {
	const host = options.host ?? PEER_PAYMENT_MESSAGEBOX_HOST;
	const messageBox = options.messageBox ?? PAYMENT_MESSAGEBOX;
	// Deny automatic AuthFetch 402 spending through the SDK payment
	// processor. The explicit receive path still internalizes via the
	// underlying wallet; only createAction/signAction are denied.
	const servicePaymentDeniedWallet =
		createPeerPayServicePaymentDeniedWallet(wallet);
	const client = new StrictPeerPayClient({
		walletClient: servicePaymentDeniedWallet,
		messageBoxHost: host,
		messageBox,
		...(options.originator === undefined
			? {}
			: { originator: options.originator }),
	});
	return {
		listPendingPayments: () =>
			listPendingPeerPayments(client, host, messageBox),
		receivePayment: (payment) => client.acceptPaymentStrict(payment, host),
	};
}
