import type {
	BroadcastFailure,
	BroadcastResponse,
	Transaction,
} from "@bsv/sdk";
import { BSOCIAL_API_URL, V5_API_URL } from "../tools/constants";
import { numArrayToBuffer } from "./buffer";

type V5BroadcastResponse = {
	success: boolean;
	status: number;
	txid: string;
	error: string;
};

export class BsocialBroadcaster {
	async broadcast(
		transaction: Transaction,
	): Promise<BroadcastResponse | BroadcastFailure> {
		const response = await fetch(`${BSOCIAL_API_URL}/submit`, {
			method: "POST",
			headers: {
				"Content-Type": "application/octet-stream",
				"X-BSV-TOPIC": "tm_bsocial,tm_bap",
			},
			body: numArrayToBuffer(transaction.toBEEF()),
		});

		if (!response.ok) {
			return {
				status: "error",
				code: response.statusText,
				txid: transaction.id("hex"),
				description: response.statusText,
			} as BroadcastFailure;
		}

		return {
			status: "success",
			txid: transaction.id("hex"),
			message: "Transaction broadcasted successfully",
		} as BroadcastResponse;
	}
}

export class V5Broadcaster {
	async broadcast(
		transaction: Transaction,
	): Promise<BroadcastResponse | BroadcastFailure> {
		const response = await fetch(`${V5_API_URL}/submit`, {
			method: "POST",
			headers: {
				"Content-Type": "application/octet-stream",
			},
			body: numArrayToBuffer(transaction.toBinary()),
		});
		const v5Response = (await response.json()) as V5BroadcastResponse;
		if (!response.ok) {
			return {
				status: "error",
				code: response.statusText,
				txid: transaction.id("hex"),
				description: v5Response.error,
			} as BroadcastFailure;
		}

		if (v5Response.success) {
			return {
				status: "success",
				txid: transaction.id("hex"),
				message: "Transaction broadcasted successfully",
			} as BroadcastResponse;
		}

		return {
			status: "error",
			code: response.statusText,
			txid: transaction.id("hex"),
			description: v5Response.error,
		} as BroadcastFailure;
	}
}
