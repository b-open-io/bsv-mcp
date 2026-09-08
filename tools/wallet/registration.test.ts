import { expect, test } from "bun:test";
import type { OneSatContext } from "@1sat/actions";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { registerAllTools } from "../index";

const fakeContext = {
	wallet: {},
	services: {},
	chain: "main",
} as unknown as OneSatContext;

async function listWalletTools(externalWallet: boolean) {
	const server = new McpServer({
		name: "wallet-registration-test",
		version: "1.0.0",
	});
	registerAllTools(server, {
		ctx: fakeContext,
		externalWallet,
		enableBsvTools: false,
		enableOrdinalsTools: false,
		enableUtilsTools: false,
		enableBapTools: false,
		enableBsocialTools: false,
		enableMneeTools: false,
		enableWalletTools: true,
	});
	const client = new Client({
		name: "wallet-registration-client",
		version: "1.0.0",
	});
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

test("embedded wallet mode advertises its whole-wallet balance read", async () => {
	const names = await listWalletTools(false);
	expect(names).toContain("wallet_getBalance");
	expect(names).toContain("wallet_createAction");
});

test("external wallet mode hides whole-wallet balance but keeps transaction tools", async () => {
	const names = await listWalletTools(true);
	expect(names).not.toContain("wallet_getBalance");
	for (const name of [
		"wallet_getAddress",
		"wallet_listOutputs",
		"wallet_getOrdinals",
		"wallet_listTokens",
		"wallet_getBsv21Balances",
		"wallet_getLockData",
	])
		expect(names).toContain(name);
	for (const name of [
		"wallet_createAction",
		"wallet_signAction",
		"wallet_sendBsv",
	])
		expect(names).toContain(name);
});
