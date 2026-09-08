import { afterEach, describe, expect, it, mock } from "bun:test";
import { createContext } from "@1sat/actions";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";

const payment = {
	messageId: "message-1",
	sender: "02".padEnd(66, "1"),
	token: { amount: 10_000 },
};

afterEach(() => mock.restore());

describe("wallet_peerPayments", () => {
	it("returns public pending payment fields for list", async () => {
		const receiver = {
			listPendingPayments: mock(async () => [payment]),
			receivePayment: mock(async () => ({})),
		};
		mock.module("../../utils/peerPaymentReceive", () => ({
			PEER_PAYMENT_MESSAGEBOX_HOST: "https://messagebox.example",
			createPeerPaymentReceiver: () => receiver,
		}));
		const { registerPeerPaymentsTool } = await import("./peerPayments");
		const server = new McpServer({ name: "test", version: "1" });
		registerPeerPaymentsTool(server, createContext({} as never));
		const client = new Client({ name: "test", version: "1" });
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		await Promise.all([
			server.connect(serverTransport),
			client.connect(clientTransport),
		]);
		try {
			const result = await client.callTool({
				name: "wallet_peerPayments",
				arguments: { operation: "list" },
			});
			expect(result.isError).not.toBe(true);
			expect(JSON.stringify(result.content)).toContain("message-1");
			expect(JSON.stringify(result.content)).not.toContain("transaction");
		} finally {
			await client.close();
			await server.close();
		}
	});

	it("requires a selected messageId and refetches before receiving", async () => {
		const receiver = {
			listPendingPayments: mock(async () => [payment]),
			receivePayment: mock(async () => ({})),
		};
		mock.module("../../utils/peerPaymentReceive", () => ({
			PEER_PAYMENT_MESSAGEBOX_HOST: "https://messagebox.example",
			createPeerPaymentReceiver: () => receiver,
		}));
		const { registerPeerPaymentsTool } = await import("./peerPayments");
		const server = new McpServer({ name: "test", version: "1" });
		registerPeerPaymentsTool(server, createContext({} as never));
		const client = new Client({ name: "test", version: "1" });
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		await Promise.all([
			server.connect(serverTransport),
			client.connect(clientTransport),
		]);
		try {
			const missing = await client.callTool({
				name: "wallet_peerPayments",
				arguments: { operation: "receive" },
			});
			expect(missing.isError).toBe(true);
			const received = await client.callTool({
				name: "wallet_peerPayments",
				arguments: {
					operation: "receive",
					messageId: "message-1",
					token: { amount: 999_999 },
				},
			});
			expect(received.isError).not.toBe(true);
			expect(receiver.receivePayment).toHaveBeenCalledWith(payment);
		} finally {
			await client.close();
			await server.close();
		}
	});

	it("does not register for an external wallet", async () => {
		const { registerPeerPaymentsTool } = await import("./peerPayments");
		const server = new McpServer({ name: "test", version: "1" });
		registerPeerPaymentsTool(
			server,
			createContext({} as never),
			undefined,
			true,
		);
		const client = new Client({ name: "test", version: "1" });
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		await Promise.all([
			server.connect(serverTransport),
			client.connect(clientTransport),
		]);
		try {
			const tools = await client.listTools();
			expect(
				tools.tools.some((tool) => tool.name === "wallet_peerPayments"),
			).toBe(false);
		} finally {
			await client.close();
			await server.close();
		}
	});
});
