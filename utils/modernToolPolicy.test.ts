import { expect, test } from "bun:test";
import type { OneSatContext } from "@1sat/actions";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { registerAllTools } from "../tools";
import { registerFindSkillsTool } from "../tools/utils/findSkills";
import { registerAppTool } from "./mcpAppRegistration";
import {
	isModernReadTool,
	MODERN_READ_TOOL_ALLOWLIST,
	modernToolDeniedResult,
	withModernToolPolicy,
} from "./modernToolPolicy";

const serverOptions = { capabilities: { tools: {} } };

const toolResult = (text: string) => ({
	content: [{ type: "text" as const, text }],
});

async function withClient<T>(
	server: McpServer,
	options: ConstructorParameters<typeof Client>[1] | undefined,
	run: (client: Client) => Promise<T>,
): Promise<T> {
	const [serverTransport, clientTransport] =
		InMemoryTransport.createLinkedPair();
	const client = new Client(
		{ name: "modern-tool-policy-test", version: "1.0.0" },
		options,
	);

	await server.connect(serverTransport);
	await client.connect(clientTransport);
	try {
		return await run(client);
	} finally {
		await client.close();
		await server.close();
	}
}

test("modern policy denies mutation and signing callbacks before they execute", async () => {
	let signActionCalls = 0;
	let appSweepCalls = 0;
	const nativeServer = new McpServer(
		{ name: "modern-policy", version: "1.0.0" },
		serverOptions,
	);
	const server = withModernToolPolicy(nativeServer, "modern");

	server.registerTool(
		"wallet_signAction",
		{ inputSchema: z.object({ reference: z.string() }) },
		async () => {
			signActionCalls += 1;
			return toolResult("signed");
		},
	);
	registerAppTool(
		server,
		"app_sweep_complete",
		{
			inputSchema: z.object({ reference: z.string() }),
			_meta: { ui: { resourceUri: "ui://modern-policy/test.html" } },
		},
		async () => {
			appSweepCalls += 1;
			return toolResult("broadcast");
		},
	);

	await withClient(server, undefined, async (client) => {
		const signResult = await client.callTool({
			name: "wallet_signAction",
			arguments: { reference: "cached-authorized-action" },
		});
		const appResult = await client.callTool({
			name: "app_sweep_complete",
			arguments: { reference: "prepared-sweep" },
		});

		expect(signResult.isError).toBe(true);
		expect(appResult.isError).toBe(true);
		expect(signActionCalls).toBe(0);
		expect(appSweepCalls).toBe(0);
	});
});

test("modern policy permits only an explicitly allowlisted read callback", async () => {
	let readCalls = 0;
	let unknownCalls = 0;
	const nativeServer = new McpServer(
		{ name: "modern-policy", version: "1.0.0" },
		serverOptions,
	);
	const server = withModernToolPolicy(nativeServer, "modern");

	server.registerTool(
		"bsv_getPrice",
		{ inputSchema: z.object({}) },
		async () => {
			readCalls += 1;
			return toolResult("read-ok");
		},
	);
	server.registerTool(
		"future_tool",
		{ inputSchema: z.object({}) },
		async () => {
			unknownCalls += 1;
			return toolResult("unexpected");
		},
	);

	await withClient(server, undefined, async (client) => {
		const readResult = await client.callTool({
			name: "bsv_getPrice",
			arguments: {},
		});
		const unknownResult = await client.callTool({
			name: "future_tool",
			arguments: {},
		});

		expect(readResult.isError).not.toBe(true);
		expect(readResult.content).toEqual([{ type: "text", text: "read-ok" }]);
		expect(unknownResult.isError).toBe(true);
		expect(readCalls).toBe(1);
		expect(unknownCalls).toBe(0);
	});
});

test("legacy policy preserves the existing callback behavior", async () => {
	let legacyCalls = 0;
	const nativeServer = new McpServer(
		{ name: "legacy-policy", version: "1.0.0" },
		{ capabilities: { tools: {} } },
	);
	const server = withModernToolPolicy(nativeServer, "legacy");
	server.registerTool(
		"wallet_signAction",
		{ inputSchema: z.object({ reference: z.string() }) },
		async () => {
			legacyCalls += 1;
			return toolResult("legacy-ok");
		},
	);

	await withClient(server, undefined, async (client) => {
		const result = await client.callTool({
			name: "wallet_signAction",
			arguments: { reference: "legacy-action" },
		});
		expect(result.isError).not.toBe(true);
		expect(result.content).toEqual([{ type: "text", text: "legacy-ok" }]);
		expect(legacyCalls).toBe(1);
	});
});

test("modern policy surface is explicit and reports a stable denial", () => {
	expect(MODERN_READ_TOOL_ALLOWLIST).toContain("bsv_getPrice");
	expect(isModernReadTool("wallet_signAction")).toBe(false);
	expect(isModernReadTool("unreviewed_future_tool")).toBe(false);
	expect(modernToolDeniedResult("wallet_signAction")).toEqual({
		content: [
			{
				type: "text",
				text: "Tool wallet_signAction is unavailable for modern MCP requests until its approval policy is reviewed.",
			},
		],
		isError: true,
	});
});

test("modern policy permits bounded skill discovery without wallet authority", async () => {
	const nativeServer = new McpServer(
		{ name: "modern-skills", version: "1" },
		serverOptions,
	);
	const server = withModernToolPolicy(nativeServer, "modern");
	let requests = 0;
	registerFindSkillsTool(server, {
		fetchFn: async () => {
			requests += 1;
			return Response.json({
				$schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
				skills: [],
			});
		},
	});
	await withClient(server, undefined, async (client) => {
		const result = await client.callTool({
			name: "utils_find_skills",
			arguments: { query: "protocol" },
		});
		expect(result.isError).not.toBe(true);
		expect(result.content).toEqual([{ type: "text", text: '{"skills":[]}' }]);
		expect(requests).toBe(1);
	});
});

test("modern policy denies full and compact PeerPay before wallet access", async () => {
	for (const profile of ["full", "compact"] as const) {
		let walletCalls = 0;
		const ctx = {
			isBaseWallet: true,
			wallet: {
				getPublicKey: async () => {
					walletCalls += 1;
					throw new Error("unexpected wallet access");
				},
			},
		} as unknown as OneSatContext;
		const nativeServer = new McpServer(
			{ name: "modern-peer", version: "1" },
			serverOptions,
		);
		const server = withModernToolPolicy(nativeServer, "modern");
		registerAllTools(server, {
			ctx,
			toolCatalog: profile,
			enableWalletTools: true,
			enableBsvTools: false,
			enableOrdinalsTools: false,
			enableUtilsTools: false,
			enableBapTools: false,
			enableBsocialTools: false,
			enableMneeTools: false,
		});
		await withClient(server, undefined, async (client) => {
			const name =
				profile === "full" ? "wallet_peerPayments" : "wallet_payments";
			expect((await client.listTools()).tools.map((t) => t.name)).toContain(
				name,
			);
			const result = await client.callTool({
				name,
				arguments:
					profile === "full"
						? { operation: "list" }
						: { operation: "wallet_peerPayments", args: { operation: "list" } },
			});
			expect(result.isError).toBe(true);
			expect(JSON.stringify(result.content)).toContain(
				"unavailable for modern MCP requests",
			);
			expect(walletCalls).toBe(0);
		});
	}
});
