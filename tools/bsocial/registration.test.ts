import { expect, test } from "bun:test";
import { createContext } from "@1sat/actions";
import { WalletClient } from "@bsv/sdk";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import type { ToolsConfig } from "../index";
import { Wallet } from "../wallet/wallet";

const publicSocialReadTools = [
	"bmap_readFollows",
	"bmap_readLikes",
	"bmap_readPosts",
	"bsocial_readPosts",
];

async function registeredSocialTools(config: Partial<ToolsConfig> = {}) {
	const { registerAllTools } = await import("../index");
	const server = new McpServer({
		name: "social-registration-test",
		version: "1",
	});
	server.registerTool(
		"registration_sentinel",
		{ description: "Test-only registration sentinel", inputSchema: {} },
		async () => ({ content: [] }),
	);
	registerAllTools(server, {
		enableBsvTools: false,
		enableOrdinalsTools: false,
		enableUtilsTools: false,
		enableBapTools: false,
		enableWalletTools: false,
		enableMneeTools: false,
		enableBsocialTools: true,
		...config,
	});

	const client = new Client({
		name: "social-registration-client",
		version: "1",
	});
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);

	try {
		return (await client.listTools()).tools
			.map((tool) => tool.name)
			.filter((name) => name !== "registration_sentinel")
			.sort();
	} finally {
		await client.close();
		await server.close();
	}
}

test("registers public social reads without a local wallet", async () => {
	expect(await registeredSocialTools()).toEqual(publicSocialReadTools);
});

test("registers public social reads for an external context without writes", async () => {
	expect(
		await registeredSocialTools({
			ctx: createContext(new WalletClient()),
		}),
	).toEqual(publicSocialReadTools);
});

test("keeps post writing available only with a custom wallet", async () => {
	expect(await registeredSocialTools({ wallet: new Wallet() })).toEqual(
		[...publicSocialReadTools, "bsocial_createPost"].sort(),
	);
});

test("excludes the complete social category when disabled", async () => {
	expect(await registeredSocialTools({ enableBsocialTools: false })).toEqual(
		[],
	);
});
