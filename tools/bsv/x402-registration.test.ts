import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { WalletInterface } from "@bsv/sdk";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import type { ToolsConfig } from "../index";
import { registerX402Tools } from "./x402";

const paymentWallet = {} as WalletInterface;
const localWallet = {} as NonNullable<ToolsConfig["wallet"]>;
const walletContext = { wallet: paymentWallet } as NonNullable<
	ToolsConfig["ctx"]
>;

async function listX402Tools(config: ToolsConfig): Promise<string[]> {
	const server = new McpServer({
		name: "x402-registration-test",
		version: "1",
	});
	const client = new Client({ name: "x402-registration-client", version: "1" });
	registerX402Tools(server, config);
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	try {
		await Promise.all([
			server.connect(serverTransport),
			client.connect(clientTransport),
		]);
		return (await client.listTools()).tools.map((tool) => tool.name);
	} finally {
		await client.close();
		await server.close();
	}
}

describe("x402 tool registration", () => {
	let previousBroadcasting: string | undefined;
	let previousWalletTools: string | undefined;

	beforeEach(() => {
		previousBroadcasting = process.env.DISABLE_BROADCASTING;
		previousWalletTools = process.env.DISABLE_WALLET_TOOLS;
		delete process.env.DISABLE_BROADCASTING;
		delete process.env.DISABLE_WALLET_TOOLS;
	});

	afterEach(() => {
		if (previousBroadcasting === undefined)
			delete process.env.DISABLE_BROADCASTING;
		else process.env.DISABLE_BROADCASTING = previousBroadcasting;
		if (previousWalletTools === undefined)
			delete process.env.DISABLE_WALLET_TOOLS;
		else process.env.DISABLE_WALLET_TOOLS = previousWalletTools;
	});

	it("always advertises x402_request and gates x402_payQuote on payment capability", async () => {
		const cases: Array<[string, ToolsConfig, boolean]> = [
			["without wallet context", {}, false],
			["with only the local wallet object", { wallet: localWallet }, false],
			["with a BRC-100 wallet context", { ctx: walletContext }, true],
			[
				"with a local wallet and BRC-100 payment context",
				{ wallet: localWallet, ctx: walletContext },
				true,
			],
			[
				"with wallet tools disabled",
				{ ctx: walletContext, enableWalletTools: false },
				false,
			],
			[
				"with an incomplete wallet context",
				{ ctx: {} as NonNullable<ToolsConfig["ctx"]> },
				false,
			],
			[
				"with broadcasting disabled in config",
				{ ctx: walletContext, disableBroadcasting: true },
				false,
			],
		];

		for (const [label, config, canPay] of cases) {
			const names = await listX402Tools(config);
			expect(names).toContain("x402_request");
			expect(names.includes("x402_payQuote"), label).toBe(canPay);
		}
	});

	it("gates payment when DISABLE_BROADCASTING is set", async () => {
		process.env.DISABLE_BROADCASTING = "true";
		const names = await listX402Tools({ ctx: walletContext });

		expect(names).toContain("x402_request");
		expect(names).not.toContain("x402_payQuote");
	});

	it("gates payment when DISABLE_WALLET_TOOLS is set", async () => {
		process.env.DISABLE_WALLET_TOOLS = "true";
		const names = await listX402Tools({ ctx: walletContext });

		expect(names).toContain("x402_request");
		expect(names).not.toContain("x402_payQuote");
	});

	it("rejects BRC-31 authentication from a payments-only role", async () => {
		const server = new McpServer({
			name: "x402-payments-role-test",
			version: "1",
		});
		const client = new Client({
			name: "x402-payments-role-client",
			version: "1",
		});
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		try {
			registerX402Tools(server, {
				ctx: walletContext,
				walletScope: "payments",
			});
			await Promise.all([
				server.connect(serverTransport),
				client.connect(clientTransport),
			]);
			const result = await client.callTool({
				name: "x402_request",
				arguments: {
					url: "https://service.example/resource",
					auth: "brc31",
				},
			});
			expect(result.isError).toBe(true);
			expect(JSON.stringify(result)).toContain("identity role");
		} finally {
			await client.close();
			await server.close();
		}
	});
});
