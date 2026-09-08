import { describe, expect, it } from "bun:test";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import {
	buildCompactFamilies,
	COMPACT_OPERATION_LEGACY_NAMES,
	registerCompactCatalog,
} from "../tools/compactCatalog";
import { registerAllTools, type ToolsConfig } from "../tools/index";

function quietConfig(overrides: ToolsConfig = {}): ToolsConfig {
	return {
		enableBsvTools: false,
		enableOrdinalsTools: false,
		enableUtilsTools: true,
		enableBapTools: false,
		enableBsocialTools: false,
		enableWalletTools: false,
		enableMneeTools: false,
		disableBroadcasting: true,
		...overrides,
	};
}

function createServer(name: string): McpServer {
	return new McpServer(
		{ name, version: "1.0.0" },
		{ capabilities: { tools: {} } },
	);
}

async function listTools(
	server: McpServer,
	clientName: string,
): Promise<Awaited<ReturnType<Client["listTools"]>>["tools"]> {
	const client = new Client({ name: clientName, version: "1.0.0" });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await server.connect(serverTransport);
	await client.connect(clientTransport);
	try {
		return (await client.listTools()).tools;
	} finally {
		await client.close();
		await server.close();
	}
}

function operationEnum(tool: { inputSchema?: unknown }): string[] | undefined {
	const schema = tool.inputSchema as {
		properties?: { operation?: { enum?: string[] } };
	};
	return schema.properties?.operation?.enum;
}

describe("skill discovery registration", () => {
	it("exposes utils_find_skills exactly once in the full catalog without a wallet", async () => {
		const server = createServer("skill-discovery-full-test");
		registerAllTools(server, quietConfig());
		const tools = await listTools(server, "skill-discovery-full-client");
		const names = tools.map((tool) => tool.name);
		expect(names.filter((name) => name === "utils_find_skills")).toHaveLength(
			1,
		);
		expect(names).toContain("utils_convertData");
	});

	it("advertises read-only annotations for utils_find_skills in the full catalog", async () => {
		const server = createServer("skill-discovery-annotations-test");
		registerAllTools(server, quietConfig());
		const tools = await listTools(server, "skill-discovery-annotations-client");
		const tool = tools.find((entry) => entry.name === "utils_find_skills");
		expect(tool).toBeDefined();
		expect(tool?.annotations?.readOnlyHint).toBe(true);
		expect(tool?.annotations?.idempotentHint).toBe(true);
		expect(tool?.annotations?.destructiveHint).toBe(false);
	});

	it("hides utils_find_skills in the full catalog when the utility category is disabled", async () => {
		const server = createServer("skill-discovery-disabled-full-test");
		registerAllTools(server, quietConfig({ enableUtilsTools: false }));
		const tools = await listTools(
			server,
			"skill-discovery-disabled-full-client",
		);
		const names = tools.map((tool) => tool.name);
		expect(names).not.toContain("utils_find_skills");
		expect(names).not.toContain("utils_convertData");
	});

	it("advertises utils_find_skills in the compact utility operation enum without a wallet", async () => {
		expect(COMPACT_OPERATION_LEGACY_NAMES.utility).toContain(
			"utils_find_skills",
		);
		const families = buildCompactFamilies(quietConfig());
		const utility = families.find((family) => family.name === "utility");
		expect(utility).toBeDefined();
		expect([...(utility?.operations.keys() ?? [])]).toContain(
			"utils_find_skills",
		);
		expect(utility?.description).toContain("skill discovery");

		const server = createServer("skill-discovery-compact-test");
		registerCompactCatalog(server, quietConfig());
		const tools = await listTools(server, "skill-discovery-compact-client");
		const utilityTool = tools.find((tool) => tool.name === "utility");
		expect(utilityTool).toBeDefined();
		expect(operationEnum(utilityTool ?? {})).toContain("utils_convertData");
		expect(operationEnum(utilityTool ?? {})).toContain("utils_find_skills");
		expect(utilityTool?.annotations?.readOnlyHint).toBe(true);
		expect(utilityTool?.annotations?.idempotentHint).toBe(true);
		expect(utilityTool?.annotations?.destructiveHint).toBe(false);
	});

	it("hides the compact utility family when the utility category is disabled", async () => {
		const families = buildCompactFamilies(
			quietConfig({ enableUtilsTools: false }),
		);
		expect(
			families.find((family) => family.name === "utility"),
		).toBeUndefined();

		const server = createServer("skill-discovery-disabled-compact-test");
		registerCompactCatalog(server, quietConfig({ enableUtilsTools: false }));
		const tools = await listTools(
			server,
			"skill-discovery-disabled-compact-client",
		);
		expect(tools.map((tool) => tool.name)).not.toContain("utility");
	});
});
