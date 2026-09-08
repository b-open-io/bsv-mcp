import { describe, expect, it } from "bun:test";
import { createMneeProvider, type MneeClient } from "./provider";

const client: MneeClient = {
	balance: async () => ({
		address: "mock-address",
		amount: 0,
		decimalAmount: 0,
	}),
	transfer: async () => ({ ticketId: "mock-ticket" }),
	getTxStatus: async () => ({
		id: "mock-ticket",
		tx_id: "mock-txid",
		tx_hex: "",
		action_requested: "transfer",
		status: "SUCCESS",
		createdAt: "",
		updatedAt: "",
		errors: null,
	}),
	parseTx: async () => ({
		txid: "mock-txid",
		environment: "production",
		type: "transfer",
		inputs: [],
		outputs: [],
		isValid: true,
		inputTotal: "0",
		outputTotal: "0",
	}),
};

describe("createMneeProvider", () => {
	it("does not call the factory until the provider is used", async () => {
		let calls = 0;
		const provider = createMneeProvider(() => {
			calls += 1;
			return client;
		});

		expect(calls).toBe(0);
		expect(await provider()).toBe(client);
		expect(calls).toBe(1);
		expect(await provider()).toBe(client);
		expect(calls).toBe(1);
	});

	it("shares one successful initialization across concurrent callers", async () => {
		let calls = 0;
		let resolve: (value: MneeClient) => void = () => {};
		const initialization = new Promise<MneeClient>((res) => {
			resolve = res;
		});
		const provider = createMneeProvider(() => {
			calls += 1;
			return initialization;
		});

		const first = provider();
		const second = provider();
		expect(calls).toBe(1);
		resolve(client);
		expect(await first).toBe(client);
		expect(await second).toBe(client);
	});

	it("discards a failed initialization so the next call can retry", async () => {
		let calls = 0;
		const provider = createMneeProvider(() => {
			calls += 1;
			if (calls === 1) return Promise.reject(new Error("temporary failure"));
			return client;
		});

		await expect(provider()).rejects.toThrow("temporary failure");
		expect(await provider()).toBe(client);
		expect(calls).toBe(2);
	});
});
