import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createConfiguredServer } from "../server.ts";
import type { ToolsConfig } from "../tools/index.ts";

const APP_RESOURCE_URI = "ui://bsv-mcp/app.html";
const CHANGELOG_URI =
	"https://github.com/b-open-io/bsv-mcp/blob/main/CHANGELOG.md";
const JUNGLEBUS_URI = "https://junglebus.gorillapool.io/docs/";

const RETIRED_PROMPT_NAMES = [
	"bitcoin_sv_ordinals",
	"bitcoin_sv_sdk_overview",
	"bitcoin_sv_sdk_wallet",
	"bitcoin_sv_sdk_transaction",
	"bitcoin_sv_sdk_auth",
	"bitcoin_sv_sdk_cryptography",
	"bitcoin_sv_sdk_script",
	"bitcoin_sv_sdk_primitives",
];

const RETIRED_RESOURCE_NAMES = [
	"brcs_readme",
	"brcs_summary",
	"brc_spec",
	"bitcom_protocol",
];

const RETIRED_RESOURCE_URI_MARKERS = ["brc://", "bitcom://", "bitcoin-sv/BRCs"];

const RETIRED_RESOURCE_URIS = [
	"https://raw.githubusercontent.com/bitcoin-sv/BRCs/master/README.md",
	"bitcom://protocol/AIP",
	"brc://wallet/1001",
];

function quietToolsConfig(): ToolsConfig {
	return {
		enableBsvTools: false,
		enableOrdinalsTools: false,
		enableUtilsTools: false,
		enableBapTools: false,
		enableBsocialTools: false,
		enableWalletTools: false,
		enableMneeTools: false,
		disableBroadcasting: true,
	};
}

function makeServer(options: {
	loadResources: boolean;
	loadPrompts?: boolean;
}) {
	return createConfiguredServer({
		toolsConfig: quietToolsConfig(),
		loadResources: options.loadResources,
		...(options.loadPrompts === undefined
			? {}
			: { loadPrompts: options.loadPrompts }),
	});
}

async function withClient<T>(
	server: ReturnType<typeof createConfiguredServer>,
	run: (client: Client) => Promise<T>,
): Promise<T> {
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const client = new Client({
		name: "skill-reference-retirement-test",
		version: "1.0.0",
	});
	await server.connect(serverTransport);
	await client.connect(clientTransport);
	try {
		return await run(client);
	} finally {
		await client.close();
		await server.close();
	}
}

function resourceIdentity(entry: { uri: string; name?: string }) {
	return `${entry.name ?? "?"}:${entry.uri}`;
}

test("retired tutorial prompts are not registered under any loadPrompts value", async () => {
	for (const loadPrompts of [true, false, undefined] as const) {
		const server = makeServer({ loadResources: false, loadPrompts });
		await withClient(server, async (client) => {
			const capabilities = client.getServerCapabilities() as {
				prompts?: unknown;
			};
			expect(capabilities.prompts).toBeUndefined();

			let promptNames: string[] = [];
			let listed = false;
			try {
				const result = await client.listPrompts();
				promptNames = result.prompts.map((prompt) => prompt.name);
				listed = true;
			} catch {
				listed = false;
			}
			if (listed) {
				for (const retired of RETIRED_PROMPT_NAMES) {
					expect(promptNames).not.toContain(retired);
				}
				expect(promptNames).toHaveLength(0);
			}

			// The server must stay usable after the prompt surface is gone.
			const tools = await client.listTools();
			expect(Array.isArray(tools.tools)).toBe(true);
		});
	}
});

test("retained changelog, JungleBus, and App resources remain; BRC/BitCom are gone", async () => {
	const server = makeServer({ loadResources: true });
	await withClient(server, async (client) => {
		const { resources } = await client.listResources();
		const uris = resources.map((resource) => resource.uri);
		expect(uris).toContain(APP_RESOURCE_URI);
		expect(uris).toContain(CHANGELOG_URI);
		expect(uris).toContain(JUNGLEBUS_URI);

		const identities = resources.map(resourceIdentity);
		for (const retiredName of RETIRED_RESOURCE_NAMES) {
			expect(
				resources.filter((resource) => resource.name === retiredName),
			).toHaveLength(0);
			expect(identities.join("\n")).not.toContain(retiredName);
		}
		for (const marker of RETIRED_RESOURCE_URI_MARKERS) {
			expect(uris.filter((uri) => uri.includes(marker))).toHaveLength(0);
		}
		expect(
			resources.filter((resource) => resource.name.startsWith("brc_")),
		).toHaveLength(0);

		const templates = await client.listResourceTemplates();
		const templateUris = templates.resourceTemplates.map(
			(template) => template.uriTemplate,
		);
		for (const marker of RETIRED_RESOURCE_URI_MARKERS) {
			expect(
				templateUris.filter((uriTemplate) => uriTemplate.includes(marker)),
			).toHaveLength(0);
		}

		// The separately registered App resource stays readable without network.
		const app = await client.readResource({ uri: APP_RESOURCE_URI });
		expect(app.contents).toHaveLength(1);
		const content = app.contents[0] as unknown as {
			uri?: string;
			text?: unknown;
		};
		expect(content.uri).toBe(APP_RESOURCE_URI);
		expect(typeof content.text).toBe("string");
		expect(content.text as string).toMatch(/<html/i);
	});
});

test("loadResources=false disables ordinary resources but retains the App resource", async () => {
	const server = makeServer({ loadResources: false });
	await withClient(server, async (client) => {
		const { resources } = await client.listResources();
		const uris = resources.map((resource) => resource.uri);
		expect(uris).toContain(APP_RESOURCE_URI);
		expect(
			resources.filter((resource) => resource.uri === APP_RESOURCE_URI),
		).toHaveLength(1);
		expect(uris).not.toContain(CHANGELOG_URI);
		expect(uris).not.toContain(JUNGLEBUS_URI);
		for (const marker of RETIRED_RESOURCE_URI_MARKERS) {
			expect(uris.filter((uri) => uri.includes(marker))).toHaveLength(0);
		}

		const templates = await client.listResourceTemplates();
		expect(
			templates.resourceTemplates.filter(
				(template) =>
					template.uriTemplate.includes("brc://") ||
					template.uriTemplate.includes("bitcom://"),
			),
		).toHaveLength(0);
	});
});

test("retired prompt and resource requests fail cleanly without crashing", async () => {
	const server = makeServer({ loadResources: true });
	await withClient(server, async (client) => {
		for (const name of ["bitcoin_sv_ordinals", "bitcoin_sv_sdk_overview"]) {
			let errorText = "";
			try {
				await client.getPrompt({ name });
			} catch (error) {
				errorText = error instanceof Error ? error.message : String(error);
			}
			expect(errorText.length).toBeGreaterThan(0);
			expect(errorText).toMatch(/not found|unknown|method/i);
		}

		for (const uri of RETIRED_RESOURCE_URIS) {
			let errorText = "";
			try {
				await client.readResource({ uri });
			} catch (error) {
				errorText = error instanceof Error ? error.message : String(error);
			}
			expect(errorText.length).toBeGreaterThan(0);
			expect(errorText).toMatch(/not found|unknown|method/i);
		}

		// Standard failures must not take the session down.
		const tools = await client.listTools();
		expect(Array.isArray(tools.tools)).toBe(true);
		const { resources } = await client.listResources();
		expect(resources.map((resource) => resource.uri)).toContain(
			APP_RESOURCE_URI,
		);
	});
});
