import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createConfiguredServer, getConfiguredTools } from "../server";

for (const toolCatalog of ["full", "compact"] as const) {
	test(`setup tool metadata matches MCP tools/list (${toolCatalog})`, async () => {
		const server = createConfiguredServer({
			toolsConfig: {
				toolCatalog,
				enableUtilsTools: true,
				enableWalletTools: false,
			},
			loadResources: false,
			loadPrompts: false,
		});
		const client = new Client({ name: "setup-catalog-test", version: "1" });
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		try {
			await server.connect(serverTransport);
			await client.connect(clientTransport);
			const listed = (await client.listTools()).tools
				.map(({ name, title, description }) => ({ name, title, description }))
				.sort((a, b) => a.name.localeCompare(b.name));
			expect(listed.length).toBeGreaterThan(0);
			expect(getConfiguredTools(server)).toEqual(listed);
		} finally {
			await client.close();
			await server.close();
		}
	});
}
