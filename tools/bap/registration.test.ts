import { afterEach, describe, expect, it } from "bun:test";
import { createContext, type OneSatContext } from "@1sat/actions";
import { PrivateKey, WalletClient } from "@bsv/sdk";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { createConfiguredServer } from "../../server";
import { registerAllTools, type ToolsConfig } from "../index";
import { Wallet } from "../wallet/wallet";

const baseConfig: ToolsConfig = {
	enableBsvTools: false,
	enableOrdinalsTools: false,
	enableUtilsTools: false,
	enableBapTools: true,
	enableWalletTools: false,
	enableBsocialTools: false,
	enableMneeTools: false,
};

const fakeIdentityKey = PrivateKey.fromRandom();
const fakeWallet = new Wallet();
const fakeContext: OneSatContext = createContext(new WalletClient());

async function listBapTools(config: ToolsConfig) {
	const server = new McpServer({
		name: "bap-registration-test",
		version: "1.0.0",
	});
	registerAllTools(server, { ...baseConfig, ...config });
	const client = new Client({
		name: "bap-registration-test",
		version: "1.0.0",
	});
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);
	try {
		return (await client.listTools()).tools.map((tool) => tool.name);
	} finally {
		await client.close();
		await server.close();
	}
}

async function listConfiguredBapTools(
	config: ToolsConfig,
	wallet?: Wallet,
	ctx?: OneSatContext,
) {
	const server = createConfiguredServer({
		toolsConfig: { ...baseConfig, ...config },
		wallet,
		ctx,
		loadPrompts: false,
		loadResources: false,
	});
	const client = new Client({
		name: "bap-configured-server-test",
		version: "1.0.0",
	});
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);
	try {
		return (await client.listTools()).tools.map((tool) => tool.name);
	} finally {
		await client.close();
		await server.close();
	}
}

describe("BAP registration capabilities", () => {
	const previousIdentityKeyWif = process.env.IDENTITY_KEY_WIF;

	afterEach(() => {
		if (previousIdentityKeyWif === undefined)
			delete process.env.IDENTITY_KEY_WIF;
		else process.env.IDENTITY_KEY_WIF = previousIdentityKeyWif;
	});

	it("keeps the public lookup available across wallet and signer modes", async () => {
		delete process.env.IDENTITY_KEY_WIF;

		const modes = [
			{
				name: "no wallet",
				config: {},
				expected: ["bap_getId"],
				absent: ["bap_getCurrentAddress", "bap_friend"],
			},
			{
				name: "identity only",
				config: { identityPk: fakeIdentityKey },
				expected: ["bap_getId", "bap_getCurrentAddress"],
				absent: ["bap_friend"],
			},
			{
				name: "local payment wallet",
				config: {
					identityPk: fakeIdentityKey,
					wallet: fakeWallet,
					xprv: "test-master-xprv",
				},
				expected: ["bap_getId", "bap_getCurrentAddress"],
				absent: [],
			},
			{
				name: "external signer",
				config: { ctx: fakeContext },
				expected: ["bap_getId"],
				absent: ["bap_getCurrentAddress", "bap_generate", "bap_friend"],
			},
		] satisfies Array<{
			name: string;
			config: ToolsConfig;
			expected: string[];
			absent: string[];
		}>;

		for (const mode of modes) {
			const catalog = await listBapTools(mode.config);
			for (const name of mode.expected)
				expect(catalog, mode.name).toContain(name);
			for (const name of mode.absent)
				expect(catalog, mode.name).not.toContain(name);
		}
	});

	it("keeps only the public lookup in configured signer and Droplit modes", async () => {
		const modes = [
			{
				name: "external signer",
				config: { ctx: fakeContext, bapPublicOnly: true },
				wallet: undefined,
				ctx: fakeContext,
			},
			{
				name: "Droplit",
				config: { wallet: fakeWallet, bapPublicOnly: true },
				wallet: fakeWallet,
				ctx: undefined,
			},
		] satisfies Array<{
			name: string;
			config: ToolsConfig;
			wallet: Wallet | undefined;
			ctx: OneSatContext | undefined;
		}>;

		for (const mode of modes) {
			const catalog = await listConfiguredBapTools(
				mode.config,
				mode.wallet,
				mode.ctx,
			);
			expect(catalog, mode.name).toContain("bap_getId");
			expect(catalog, mode.name).not.toContain("bap_generate");
			expect(catalog, mode.name).not.toContain("bap_friend");
			expect(catalog, mode.name).not.toContain("bap_getCurrentAddress");
		}
	});
});
