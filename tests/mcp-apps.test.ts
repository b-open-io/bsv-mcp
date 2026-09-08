import { afterEach, expect, test } from "bun:test";
import type { OneSatContext } from "@1sat/actions";
import type { OneSatServices } from "@1sat/client";
import { Client } from "@modelcontextprotocol/client";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createConfiguredServer } from "../server.ts";
import type { ToolsConfig } from "../tools/index.ts";
import { contentUrl } from "../utils/backends.ts";

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

const originalDisableBroadcasting = process.env.DISABLE_BROADCASTING;

afterEach(() => {
	if (originalDisableBroadcasting === undefined)
		delete process.env.DISABLE_BROADCASTING;
	else process.env.DISABLE_BROADCASTING = originalDisableBroadcasting;
});

type UiToolMeta = {
	ui?: {
		resourceUri?: string;
		visibility?: string[];
	};
	"ui/resourceUri"?: string;
};

type UiResourceMeta = {
	ui?: {
		csp?: {
			resourceDomains?: string[];
			connectDomains?: string[];
		};
	};
};

const fakeServices = {} as OneSatServices;
const fakeContext = {
	wallet: {
		createAction: async () => ({}),
		signAction: async () => ({ txid: "test-txid" }),
	},
	services: fakeServices,
	chain: "main",
	isBaseWallet: true,
} as unknown as OneSatContext;
const fakeWallet = {} as import("../tools/wallet/wallet.ts").Wallet;
const fakeDroplit = {
	isDroplitMode: true,
	getDroplitClient: () => undefined,
} as unknown as NonNullable<ToolsConfig["integratedWallet"]>;

type AppServerOptions = Partial<ToolsConfig> & {
	ctx?: OneSatContext;
	includeContext?: boolean;
};

function appServerOptions(options: AppServerOptions = {}) {
	const { ctx: explicitCtx, includeContext = true, ...toolsConfig } = options;
	const ctx = includeContext ? (explicitCtx ?? fakeContext) : undefined;
	return {
		toolsConfig: {
			enableBsvTools: true,
			enableOrdinalsTools: true,
			enableUtilsTools: false,
			enableBapTools: false,
			enableBsocialTools: false,
			enableWalletTools: true,
			enableMneeTools: false,
			disableBroadcasting: false,
			...(ctx ? { ctx, services: ctx.services } : {}),
			...toolsConfig,
		},
		...(ctx ? { ctx } : {}),
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
	options: AppServerOptions = {},
): Promise<T> {
	const server = createConfiguredServer(appServerOptions(options));
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

function fakeSweepContext(
	isBaseWallet: boolean,
	resultTxid = "sweep-txid",
): { ctx: OneSatContext; calls: unknown[] } {
	const calls: unknown[] = [];
	const ctx = {
		chain: "main",
		isBaseWallet,
		services: fakeServices,
		wallet: {
			createAction: async () => ({}),
			signAction: async (args: unknown) => {
				calls.push(args);
				return { txid: resultTxid };
			},
		},
	} as unknown as OneSatContext;

	return { ctx, calls };
}

test("v2 tools/list preserves app registration metadata and app-only visibility", async () => {
	await withAppClient(async (client) => {
		const { tools } = await client.listTools();
		const names = tools.map((tool) => tool.name);
		for (const name of APP_TOOL_NAMES) expect(names).toContain(name);

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
	});
});

test("app_sweep_complete is hidden when broadcasting is disabled", async () => {
	const { ctx } = fakeSweepContext(true);

	await withAppClient(
		async (client) => {
			const { tools } = await client.listTools();
			const names = tools.map((tool) => tool.name);
			expect(names).toContain("app_sweep_prepare");
			expect(names).not.toContain("app_sweep_complete");
		},
		{ ctx, disableBroadcasting: true },
	);
});

test("app_sweep_complete honors the environment guard through registration", async () => {
	process.env.DISABLE_BROADCASTING = "true";
	const { ctx, calls } = fakeSweepContext(false);

	await withAppClient(
		async (client) => {
			const { tools } = await client.listTools();
			expect(tools.map((tool) => tool.name)).not.toContain(
				"app_sweep_complete",
			);
			expect(calls).toHaveLength(0);
		},
		{
			ctx,
			disableBroadcasting: false,
		},
	);
});

test("app_sweep_complete forwards the reference and spends when enabled", async () => {
	process.env.DISABLE_BROADCASTING = "false";
	const reference = "enabled-reference";
	const spends = { "0": { unlockingScript: "51" } };

	for (const isBaseWallet of [true, false]) {
		const { ctx, calls } = fakeSweepContext(
			isBaseWallet,
			isBaseWallet ? "local-remote-sweep-txid" : "external-sweep-txid",
		);

		await withAppClient(
			async (client) => {
				const result = await client.callTool({
					name: "app_sweep_complete",
					arguments: { reference, spends },
				});

				expect(result.structuredContent).toEqual({
					txid: isBaseWallet
						? "local-remote-sweep-txid"
						: "external-sweep-txid",
					success: true,
				});
				expect(calls).toEqual([
					{
						reference,
						spends,
						options: { acceptDelayedBroadcast: false },
					},
				]);
			},
			{
				ctx,
				externalWallet: !isBaseWallet,
				disableBroadcasting: false,
			},
		);
	}
});

async function appToolNames(options: AppServerOptions) {
	let names: string[] = [];
	await withAppClient(async (client) => {
		const listed = await client.listTools();
		names = listed.tools.map((tool) => tool.name);
	}, options);
	return names;
}

test("v2 app tools follow wallet, context, and category capabilities", async () => {
	const publicNames = await appToolNames({ includeContext: false });
	for (const name of [
		"bsv_dashboard",
		"app_explorer_data",
		"app_ordinals_data",
		"app_sweep_scan",
	]) {
		expect(publicNames).toContain(name);
	}
	for (const name of [
		"app_wallet_data",
		"app_sweep_prepare",
		"app_sweep_complete",
	]) {
		expect(publicNames).not.toContain(name);
	}

	const localNames = await appToolNames({
		wallet: fakeWallet,
		includeContext: false,
	});
	expect(localNames).toContain("app_wallet_data");
	expect(localNames).not.toContain("app_sweep_prepare");
	expect(localNames).not.toContain("app_sweep_complete");

	const embeddedNames = await appToolNames({ externalWallet: false });
	for (const name of APP_TOOL_NAMES) expect(embeddedNames).toContain(name);

	const externalNames = await appToolNames({ externalWallet: true });
	expect(externalNames).not.toContain("app_wallet_data");
	for (const name of ["app_sweep_prepare", "app_sweep_complete"]) {
		expect(externalNames).toContain(name);
	}

	const droplitNames = await appToolNames({
		integratedWallet: fakeDroplit,
		includeContext: false,
	});
	for (const name of [
		"bsv_dashboard",
		"app_explorer_data",
		"app_ordinals_data",
		"app_sweep_scan",
	]) {
		expect(droplitNames).toContain(name);
	}
	for (const name of [
		"app_wallet_data",
		"app_sweep_prepare",
		"app_sweep_complete",
	]) {
		expect(droplitNames).not.toContain(name);
	}

	const noBsvNames = await appToolNames({
		enableBsvTools: false,
		includeContext: false,
	});
	expect(noBsvNames).not.toContain("app_explorer_data");
	expect(noBsvNames).toContain("app_ordinals_data");

	const noOrdinalsNames = await appToolNames({
		enableOrdinalsTools: false,
		includeContext: false,
	});
	expect(noOrdinalsNames).toContain("app_explorer_data");
	expect(noOrdinalsNames).not.toContain("app_ordinals_data");
	expect(noOrdinalsNames).not.toContain("app_sweep_scan");

	const noWalletNames = await appToolNames({ enableWalletTools: false });
	expect(noWalletNames).not.toContain("app_wallet_data");
	expect(noWalletNames).not.toContain("app_sweep_prepare");
	expect(noWalletNames).not.toContain("app_sweep_complete");
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
		const content = result.contents[0];
		if (!content || !("text" in content)) {
			throw new Error("Expected MCP App resource to return text content");
		}
		expect(content).toMatchObject({
			uri: APP_RESOURCE_URI,
			mimeType: RESOURCE_MIME_TYPE,
		});
		const text = content.text;
		expect(typeof text).toBe("string");
		expect(text).toMatch(/<html/i);

		// The server returns a small HTML placeholder when the Vite artifact is
		// absent. Require the built view's stable shell markers so this test
		// proves the advertised resource is actually renderable.
		expect(text).not.toContain("Dashboard not built. Run");
		expect(text).toContain("<title>BSV Dashboard</title>");
		for (const marker of [
			'id="app"',
			'id="explorer-panel"',
			'id="wallet-panel"',
			'id="ordinals-panel"',
			'id="sweep-panel"',
		]) {
			expect(text).toContain(marker);
		}

		const resourceMeta = (content as { _meta?: UiResourceMeta })._meta;
		expect(resourceMeta?.ui?.csp?.resourceDomains).toEqual([
			new URL(contentUrl()).origin,
			"https://fonts.googleapis.com",
			"https://fonts.gstatic.com",
		]);
		expect(resourceMeta?.ui?.csp?.connectDomains).toBeUndefined();
	});
});
