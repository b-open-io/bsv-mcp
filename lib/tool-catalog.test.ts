import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import type { OneSatContext } from "@1sat/actions";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createConfiguredServer } from "../server";
import {
	COMPACT_OPERATION_LEGACY_NAMES,
	getCompactCapabilityMetadata,
	resolveToolCatalogFromEnvironment,
	resolveToolCatalogProfile,
} from "../tools/compactCatalog";
import { Wallet } from "../tools/wallet/wallet";

function syntheticWallet() {
	return Object.create(Wallet.prototype) as Wallet;
}

async function listCompactTools(externalWallet = false) {
	const wallet = syntheticWallet();
	const ctx = externalWallet
		? ({
				wallet: {},
				services: {},
				chain: "main",
			} as unknown as OneSatContext)
		: undefined;
	const server = createConfiguredServer({
		toolsConfig: {
			toolCatalog: "compact",
			wallet,
			enableBsvTools: true,
			enableOrdinalsTools: true,
			enableUtilsTools: true,
			enableWalletTools: true,
			disableBroadcasting: true,
			...(ctx ? { ctx, externalWallet: true } : {}),
		},
		wallet,
		...(ctx ? { ctx } : {}),
		loadPrompts: false,
		loadResources: false,
	});
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const client = new Client({ name: "compact-catalog-test", version: "1.0.0" });
	try {
		await server.connect(serverTransport);
		await client.connect(clientTransport);
		return { client, server };
	} catch (error) {
		await client.close();
		await server.close();
		throw error;
	}
}

test("full remains the default and compact is explicit", () => {
	expect(resolveToolCatalogProfile()).toBe("full");
	expect(resolveToolCatalogProfile({ toolCatalog: "full" })).toBe("full");
	expect(resolveToolCatalogProfile({ toolCatalog: "compact" })).toBe("compact");
	expect(resolveToolCatalogFromEnvironment(undefined)).toBe("full");
	expect(resolveToolCatalogFromEnvironment("compact")).toBe("compact");
	expect(() => resolveToolCatalogFromEnvironment("invalid")).toThrow(
		'MCP_TOOL_CATALOG must be "full" or "compact"',
	);
});

function runConfiguredCatalogProcess(value: string): Promise<{
	code: number | null;
	stdout: string;
	stderr: string;
}> {
	return new Promise((resolve, reject) => {
		const child = spawn(
			process.execPath,
			[
				"-e",
				'import { CONFIG } from "./server.ts"; process.stdout.write("PROFILE=" + CONFIG.toolCatalog);',
			],
			{
				cwd: process.cwd(),
				env: { ...process.env, MCP_TOOL_CATALOG: value, TRANSPORT: "stdio" },
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.once("error", reject);
		child.once("close", (code) => resolve({ code, stdout, stderr }));
	});
}

test("configured startup maps MCP_TOOL_CATALOG and rejects invalid values", async () => {
	const compact = await runConfiguredCatalogProcess("compact");
	expect(compact.code).toBe(0);
	expect(compact.stdout).toContain("PROFILE=compact");

	const invalid = await runConfiguredCatalogProcess("invalid");
	expect(invalid.code).not.toBe(0);
	expect(invalid.stderr).toContain(
		'MCP_TOOL_CATALOG must be "full" or "compact"',
	);
});

test("configured stdio startup exposes the selected compact catalog", async () => {
	const inherited = Object.fromEntries(
		Object.entries(process.env).filter(
			(entry): entry is [string, string] => entry[1] !== undefined,
		),
	);
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: ["run", "index.ts", "--stdio"],
		cwd: process.cwd(),
		env: {
			...inherited,
			MCP_TOOL_CATALOG: "compact",
			TRANSPORT: "stdio",
			DISABLE_WALLET_TOOLS: "true",
			DISABLE_BAP_TOOLS: "true",
			DISABLE_BSOCIAL_TOOLS: "true",
			DISABLE_MNEE_TOOLS: "true",
			DISABLE_PROMPTS: "true",
			DISABLE_RESOURCES: "true",
		},
		stderr: "pipe",
	});
	const client = new Client(
		{ name: "compact-stdio-test", version: "1.0.0" },
		{ versionNegotiation: { mode: "auto" } },
	);
	try {
		await client.connect(transport);
		const { tools } = await client.listTools();
		expect(tools.map((tool) => tool.name)).toEqual([
			"bsv_read",
			"ordinals_read",
			"utility",
		]);
	} finally {
		await client.close();
		await transport.close();
	}
});

test("compact advertises bounded read families without app tools", async () => {
	const { client, server } = await listCompactTools();
	try {
		const first = await client.listTools();
		const second = await client.listTools();
		const names = first.tools.map((tool) => tool.name);
		expect(names).toEqual([
			"bsv_read",
			"ordinals_read",
			"wallet_read",
			"utility",
		]);
		expect(names).toEqual(second.tools.map((tool) => tool.name));
		expect(new Set(names).size).toBe(names.length);
		expect(names).not.toContain("bsv_dashboard");

		for (const tool of first.tools) {
			const schema = tool.inputSchema as {
				properties?: {
					operation?: { enum?: string[] };
					args?: Record<string, unknown>;
				};
				anyOf?: unknown;
				oneOf?: unknown;
			};
			expect(schema.properties?.operation?.enum?.length).toBeGreaterThan(0);
			expect(schema.anyOf).toBeUndefined();
			expect(schema.oneOf).toBeUndefined();
			expect(tool.annotations?.readOnlyHint).toBe(true);
			expect(tool.annotations?.idempotentHint).toBe(true);
			expect(tool.annotations?.destructiveHint).toBe(false);
		}

		const conversion = await client.callTool({
			name: "utility",
			arguments: {
				operation: "utils_convertData",
				args: { data: "hello", from: "utf8", to: "hex" },
			},
		});
		expect(conversion.isError).toBeUndefined();
		expect(conversion.content).toEqual([{ type: "text", text: "68656c6c6f" }]);

		const unknown = await client.callTool({
			name: "utility",
			arguments: { operation: "utility_missing", args: {} },
		});
		expect(unknown.isError).toBe(true);
		expect(unknown.content).toEqual([
			{
				type: "text",
				text: "Error: COMPACT_UNKNOWN_OPERATION: utility_missing",
			},
		]);
	} finally {
		await client.close();
		await server.close();
	}
});

test("compact external mode omits whole-wallet balance and keeps scoped reads", async () => {
	const { client, server } = await listCompactTools(true);
	try {
		const { tools } = await client.listTools();
		const walletRead = tools.find((tool) => tool.name === "wallet_read");
		if (!walletRead) throw new Error("Expected wallet_read in tools/list");
		const operationEnum = (
			walletRead.inputSchema as {
				properties?: { operation?: { enum?: string[] } };
			}
		).properties?.operation?.enum;
		expect(operationEnum).toContain("wallet_getAddress");
		expect(operationEnum).not.toContain("wallet_getBalance");
	} finally {
		await client.close();
		await server.close();
	}
});

test("compact operation map has one legacy name per family membership", () => {
	const entries = Object.entries(COMPACT_OPERATION_LEGACY_NAMES).flatMap(
		([family, names]) => names.map((legacyName) => ({ family, legacyName })),
	);
	expect(new Set(entries.map(({ legacyName }) => legacyName)).size).toBe(
		entries.length,
	);
	const unavailable = getCompactCapabilityMetadata({
		wallet: syntheticWallet(),
		enableBsvTools: false,
		enableOrdinalsTools: false,
		enableUtilsTools: false,
		enableWalletTools: true,
	});
	for (const capability of unavailable.filter(
		(item) => item.family === "wallet_read",
	)) {
		if (capability.operation.startsWith("wallet_get"))
			expect(capability.legacyName).toBe(capability.operation);
	}
});
