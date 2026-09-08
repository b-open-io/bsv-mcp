import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { buildCompactFamilies } from "../compactCatalog";
import { registerAllTools } from "../index";
import {
	isWalletOnboardingAvailable,
	registerWalletOnboardingTool,
	WALLET_ONBOARDING_TOOL_NAME,
} from "./onboarding";

function createServer() {
	return new McpServer({
		name: "wallet-onboarding-test",
		version: "1.0.0",
	});
}

async function listToolsWithClient(server: McpServer) {
	const client = new Client({
		name: "wallet-onboarding-client",
		version: "1.0.0",
	});
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);
	try {
		return {
			client,
			tools: (await client.listTools()).tools,
		};
	} catch (error) {
		await client.close();
		await server.close();
		throw error;
	}
}

async function closePair(client: Client, server: McpServer) {
	await client.close();
	await server.close();
}

const disabledCategories = {
	enableBsvTools: false,
	enableOrdinalsTools: false,
	enableUtilsTools: false,
	enableBapTools: false,
	enableBsocialTools: false,
	enableMneeTools: false,
	enableWalletTools: false,
} as const;

describe("wallet onboarding availability", () => {
	test("available only with walletSetupNeeded true and an opener", () => {
		expect(
			isWalletOnboardingAvailable({
				walletSetupNeeded: true,
				openWalletSetup: async () => {},
			}),
		).toBe(true);
		expect(isWalletOnboardingAvailable({})).toBe(false);
		expect(
			isWalletOnboardingAvailable({
				walletSetupNeeded: true,
			}),
		).toBe(false);
		expect(
			isWalletOnboardingAvailable({
				walletSetupNeeded: false,
				openWalletSetup: async () => {},
			}),
		).toBe(false);
	});
});

describe("wallet onboarding tool", () => {
	test("exposes an empty input schema with mutating annotations", async () => {
		const server = createServer();
		registerWalletOnboardingTool(server, async () => {});
		const { client, tools } = await listToolsWithClient(server);
		try {
			const tool = tools.find(
				(entry) => entry.name === WALLET_ONBOARDING_TOOL_NAME,
			);
			expect(tool).toBeDefined();
			expect(tool?.annotations).toMatchObject({
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: false,
				openWorldHint: true,
			});
			const schema = tool?.inputSchema as {
				type?: string;
				properties?: Record<string, unknown>;
			};
			expect(schema.properties ?? {}).toEqual({});
		} finally {
			await closePair(client, server);
		}
	});

	test("awaits the opener and returns public status without secrets", async () => {
		let calls = 0;
		const server = createServer();
		registerWalletOnboardingTool(server, async () => {
			calls += 1;
		});
		const { client } = await listToolsWithClient(server);
		try {
			const result = await client.callTool({
				name: WALLET_ONBOARDING_TOOL_NAME,
				arguments: {},
			});
			expect(calls).toBe(1);
			expect(result.isError ?? false).toBe(false);
			const text = (result.content as Array<{ text: string }>)
				.map((entry) => entry.text)
				.join("\n");
			expect(text).toContain('"opened"');
			expect(text).toContain("Complete wallet setup in the browser.");
			expect(text).not.toContain("http");
			expect(text).not.toContain("token");
		} finally {
			await closePair(client, server);
		}
	});

	test("returns a safe error without secrets on opener failure", async () => {
		const server = createServer();
		registerWalletOnboardingTool(server, async () => {
			throw new Error(
				"boom with bearer https://example.test/setup?token=secret-token",
			);
		});
		const { client } = await listToolsWithClient(server);
		try {
			const result = await client.callTool({
				name: WALLET_ONBOARDING_TOOL_NAME,
				arguments: {},
			});
			expect(result.isError).toBe(true);
			const text = (result.content as Array<{ text: string }>)
				.map((entry) => entry.text)
				.join("\n");
			expect(text).not.toContain("https://example.test");
			expect(text).not.toContain("secret-token");
		} finally {
			await closePair(client, server);
		}
	});
});

describe("wallet onboarding catalog wiring", () => {
	test("full catalog registers only when setup is needed", async () => {
		const server = createServer();
		registerAllTools(server, {
			...disabledCategories,
			walletSetupNeeded: true,
			openWalletSetup: async () => {},
		});
		const { client, tools } = await listToolsWithClient(server);
		try {
			expect(tools.map((tool) => tool.name)).toContain(
				WALLET_ONBOARDING_TOOL_NAME,
			);
		} finally {
			await closePair(client, server);
		}
	});

	test("full catalog omits the tool without setup state", async () => {
		for (const config of [
			{ ...disabledCategories },
			{ ...disabledCategories, walletSetupNeeded: true },
			{ ...disabledCategories, openWalletSetup: async () => {} },
			{
				...disabledCategories,
				walletSetupNeeded: false,
				openWalletSetup: async () => {},
			},
		]) {
			const server = createServer();
			registerAllTools(server, config);
			const { client, tools } = await listToolsWithClient(server);
			try {
				expect(tools.map((tool) => tool.name)).not.toContain(
					WALLET_ONBOARDING_TOOL_NAME,
				);
			} finally {
				await closePair(client, server);
			}
		}
	});

	test("compact catalog exposes the same tool in a dedicated mutating family", async () => {
		const families = buildCompactFamilies({
			...disabledCategories,
			toolCatalog: "compact",
			walletSetupNeeded: true,
			openWalletSetup: async () => {},
		});
		const family = families.find((entry) => entry.name === "wallet_setup");
		expect(family).toBeDefined();
		expect(family?.operations.has(WALLET_ONBOARDING_TOOL_NAME)).toBe(true);
		expect(family?.annotations).toMatchObject({
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: true,
		});
		expect(
			family?.operations.get(WALLET_ONBOARDING_TOOL_NAME)?.annotations,
		).toMatchObject({
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: true,
		});
		expect(
			families.find((entry) => entry.name === "wallet_read"),
		).toBeUndefined();
	});

	test("compact catalog omits setup without setup state", () => {
		const families = buildCompactFamilies({
			...disabledCategories,
			toolCatalog: "compact",
		});
		expect(
			families.flatMap((family) => [...family.operations.keys()]),
		).not.toContain(WALLET_ONBOARDING_TOOL_NAME);
	});

	test("compact registration calls the opener and returns public status", async () => {
		let calls = 0;
		const server = createServer();
		registerAllTools(server, {
			...disabledCategories,
			toolCatalog: "compact",
			walletSetupNeeded: true,
			openWalletSetup: async () => {
				calls += 1;
			},
		});
		const { client, tools } = await listToolsWithClient(server);
		try {
			expect(tools.map((tool) => tool.name)).toContain("wallet_setup");
			expect(tools.map((tool) => tool.name)).not.toContain(
				WALLET_ONBOARDING_TOOL_NAME,
			);
			const walletSetup = tools.find((tool) => tool.name === "wallet_setup");
			expect(walletSetup?.annotations).toMatchObject({
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: false,
				openWorldHint: true,
			});
			const result = await client.callTool({
				name: "wallet_setup",
				arguments: { operation: WALLET_ONBOARDING_TOOL_NAME, args: {} },
			});
			expect(calls).toBe(1);
			expect(result.isError ?? false).toBe(false);
			const text = (result.content as Array<{ text: string }>)
				.map((entry) => entry.text)
				.join("\n");
			expect(text).toContain('"opened"');
		} finally {
			await closePair(client, server);
		}
	});
});
