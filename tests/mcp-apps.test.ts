import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/client";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createConfiguredServer } from "../server.ts";

const APP_RESOURCE_URI = "ui://bsv-mcp/app.html";
const APP_TOOL_NAMES = [
	"bsv_dashboard",
	"app_explorer_data",
	"app_wallet_data",
	"app_ordinals_data",
	"app_sweep_scan",
	"app_sweep_prepare",
	"app_sweep_complete",
] as const;

type UiToolMeta = {
	ui?: {
		resourceUri?: string;
		visibility?: string[];
	};
	"ui/resourceUri"?: string;
};

function appServerOptions() {
	return {
		// Keep this proof offline: app registration is independent of wallet and
		// network-backed tool registration.
		toolsConfig: {
			enableBsvTools: false,
			enableOrdinalsTools: false,
			enableUtilsTools: false,
			enableA2bTools: false,
			enableBapTools: false,
			enableBsocialTools: false,
			enableWalletTools: false,
			enableMneeTools: false,
			disableBroadcasting: true,
		},
		loadPrompts: false,
		loadResources: false,
	};
}

function findTool(
	tools: Awaited<ReturnType<Client["listTools"]>>["tools"],
	name: string,
) {
	const tool = tools.find((candidate) => candidate.name === name);
	if (!tool) throw new Error(`Expected ${name} in tools/list`);
	return tool;
}

async function withAppClient<T>(
	run: (client: Client) => Promise<T>,
): Promise<T> {
	const server = createConfiguredServer(appServerOptions());
	const [serverTransport, clientTransport] =
		InMemoryTransport.createLinkedPair();
	const client = new Client({ name: "bsv-mcp-apps-v2-test", version: "1.0.0" });

	await server.connect(serverTransport);
	await client.connect(clientTransport);
	try {
		return await run(client);
	} finally {
		await client.close();
		await server.close();
	}
}

test("v2 tools/list preserves app registration metadata and app-only visibility", async () => {
	await withAppClient(async (client) => {
		const { tools } = await client.listTools();
		expect(tools.map((tool) => tool.name)).toEqual(APP_TOOL_NAMES);

		const dashboard = findTool(tools, "bsv_dashboard");
		expect(dashboard.title).toBe("BSV Dashboard");
		expect(dashboard.description).toContain("Interactive BSV dashboard");
		expect(dashboard.inputSchema).toMatchObject({
			type: "object",
			properties: {},
		});
		const dashboardMeta = dashboard._meta as UiToolMeta | undefined;
		expect(dashboardMeta?.ui?.resourceUri).toBe(APP_RESOURCE_URI);
		expect(dashboardMeta?.["ui/resourceUri"]).toBe(APP_RESOURCE_URI);
		expect(dashboardMeta?.ui?.visibility).toBeUndefined();

		for (const name of APP_TOOL_NAMES.slice(1)) {
			const tool = findTool(tools, name);
			const meta = tool._meta as UiToolMeta | undefined;
			expect(meta?.ui?.resourceUri).toBe(APP_RESOURCE_URI);
			expect(meta?.["ui/resourceUri"]).toBe(APP_RESOURCE_URI);
			expect(meta?.ui?.visibility).toEqual(["app"]);
		}

		const sweepScan = findTool(tools, "app_sweep_scan");
		expect(sweepScan.inputSchema).toMatchObject({
			type: "object",
			required: ["address"],
		});
	});
});

test("v2 tools/call keeps progressive text and structured app results", async () => {
	await withAppClient(async (client) => {
		const dashboard = await client.callTool({
			name: "bsv_dashboard",
			arguments: {},
		});
		expect(dashboard.content).toEqual([
			{ type: "text", text: "BSV Dashboard opened" },
		]);
		expect(dashboard.structuredContent).toEqual({
			view: "dashboard",
			ready: true,
		});

		// This app-only callback has a deterministic no-wallet branch, so the
		// regression test never creates keys, calls a wallet, or reaches a service.
		const wallet = await client.callTool({
			name: "app_wallet_data",
			arguments: {},
		});
		expect(wallet.content).toEqual([
			{ type: "text", text: "No wallet configured" },
		]);
		expect(wallet.structuredContent).toEqual({
			error: "No wallet configured. Set PRIVATE_KEY_WIF or generate keys.",
		});
	});
});

test("v2 resources/list and resources/read expose the MCP App HTML resource", async () => {
	await withAppClient(async (client) => {
		const { resources } = await client.listResources();
		const appResources = resources.filter(
			(resource) => resource.uri === APP_RESOURCE_URI,
		);
		expect(appResources).toHaveLength(1);
		expect(appResources[0]).toMatchObject({
			uri: APP_RESOURCE_URI,
			mimeType: RESOURCE_MIME_TYPE,
		});

		const result = await client.readResource({ uri: APP_RESOURCE_URI });
		expect(result.contents).toHaveLength(1);
		expect(result.contents[0]).toMatchObject({
			uri: APP_RESOURCE_URI,
			mimeType: RESOURCE_MIME_TYPE,
		});
		const text = result.contents[0].text;
		expect(typeof text).toBe("string");
		expect(text).toMatch(/<html/i);
		expect(text).toContain("Dashboard");
	});
});
