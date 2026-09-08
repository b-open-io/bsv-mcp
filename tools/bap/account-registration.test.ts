import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { PrivateKey } from "@bsv/sdk";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { shouldAdvertiseLocalAccount } from "../../server";
import { registerAllTools, type ToolsConfig } from "../index";

const identityPk = PrivateKey.fromString("1", 16);
const paymentPk = PrivateKey.fromString("2", 16);

const originalIdentityKeyWif = process.env.IDENTITY_KEY_WIF;
const originalDisableBapTools = process.env.DISABLE_BAP_TOOLS;

beforeEach(() => {
	delete process.env.IDENTITY_KEY_WIF;
	process.env.DISABLE_BAP_TOOLS = "false";
});

afterEach(() => {
	if (originalIdentityKeyWif === undefined) delete process.env.IDENTITY_KEY_WIF;
	else process.env.IDENTITY_KEY_WIF = originalIdentityKeyWif;
	if (originalDisableBapTools === undefined)
		delete process.env.DISABLE_BAP_TOOLS;
	else process.env.DISABLE_BAP_TOOLS = originalDisableBapTools;
});

async function listTools(config: ToolsConfig = {}) {
	const server = new McpServer({ name: "bap-registration-test", version: "1" });
	registerAllTools(server, {
		enableBsvTools: false,
		enableOrdinalsTools: false,
		enableUtilsTools: false,
		enableBsocialTools: false,
		enableWalletTools: false,
		enableMneeTools: false,
		enableBapTools: true,
		disableBroadcasting: true,
		...config,
	});
	const client = new Client({ name: "bap-registration-client", version: "1" });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await server.connect(serverTransport);
	await client.connect(clientTransport);
	try {
		return (await client.listTools()).tools.map((tool) => tool.name);
	} finally {
		await client.close();
		await server.close();
	}
}

function has(names: string[], name: string) {
	return names.includes(name);
}

describe("BAP generation registration capability", () => {
	test("maps startup key sources to the local account capability", () => {
		expect(shouldAdvertiseLocalAccount("encrypted", false, false)).toBe(true);
		for (const source of ["env", "none", "external"] as const)
			expect(shouldAdvertiseLocalAccount(source, false, false)).toBe(false);
		expect(shouldAdvertiseLocalAccount("encrypted", true, false)).toBe(false);
		expect(shouldAdvertiseLocalAccount("encrypted", false, true)).toBe(false);
	});

	test("requires an explicitly available local encrypted account", async () => {
		for (const config of [
			{ wallet: {} as ToolsConfig["wallet"] },
			{ payPk: paymentPk, localAccountAvailable: false },
		]) {
			expect(has(await listTools(config), "bap_generate")).toBe(false);
		}

		expect(
			has(
				await listTools({ payPk: paymentPk, localAccountAvailable: true }),
				"bap_generate",
			),
		).toBe(true);
	});

	test("keeps generation hidden when identity material already exists", async () => {
		for (const config of [{ identityPk }, { xprv: "xprv-test" }]) {
			expect(
				has(
					await listTools({ ...config, localAccountAvailable: true }),
					"bap_generate",
				),
			).toBe(false);
		}

		process.env.IDENTITY_KEY_WIF = identityPk.toWif();
		expect(
			has(await listTools({ localAccountAvailable: true }), "bap_generate"),
		).toBe(false);
	});

	test("keeps public bap_getId available regardless of account capability", async () => {
		for (const localAccountAvailable of [undefined, false, true]) {
			expect(has(await listTools({ localAccountAvailable }), "bap_getId")).toBe(
				true,
			);
		}
	});

	test("honors the BAP category config and environment gates", async () => {
		expect(
			has(
				await listTools({
					localAccountAvailable: true,
					enableBapTools: false,
				}),
				"bap_generate",
			),
		).toBe(false);

		process.env.DISABLE_BAP_TOOLS = "true";
		expect(
			has(await listTools({ localAccountAvailable: true }), "bap_generate"),
		).toBe(false);
	});
});

describe("BAP generation wallet and context modes", () => {
	test("does not register generation for context-only signers", async () => {
		const names = await listTools({
			ctx: {} as ToolsConfig["ctx"],
			localAccountAvailable: true,
		});
		expect(has(names, "bap_generate")).toBe(false);
	});

	test("supports a local wallet with context and a local sponsor", async () => {
		const walletAndContext = await listTools({
			ctx: {} as ToolsConfig["ctx"],
			wallet: {} as ToolsConfig["wallet"],
			localAccountAvailable: true,
		});
		expect(has(walletAndContext, "bap_generate")).toBe(false);
		expect(has(walletAndContext, "bap_publishIdentity")).toBe(true);

		const sponsored = await listTools({
			droplitClient: {} as ToolsConfig["droplitClient"],
			localAccountAvailable: true,
		});
		expect(has(sponsored, "bap_generate")).toBe(true);
	});

	test("does not forward local generation capability to Droplit mode", async () => {
		const names = await listTools({
			integratedWallet: {
				isDroplitMode: true,
			} as ToolsConfig["integratedWallet"],
			localAccountAvailable: true,
		});
		expect(has(names, "bap_generate")).toBe(false);
	});
});
