import { expect, spyOn, test } from "bun:test";
import { HD } from "@bsv/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBapGenerateTool } from "./generate";

test("BAP generation refuses a locked account before generating an identity", async () => {
	const password = process.env.BSV_MCP_PASSWORD;
	delete process.env.BSV_MCP_PASSWORD;
	const generate = spyOn(HD, "fromRandom");
	const server = new McpServer({ name: "test", version: "1" });
	registerBapGenerateTool(server, { disableBroadcasting: true });
	const client = new Client({ name: "test", version: "1" });
	const [a, b] = InMemoryTransport.createLinkedPair();
	try {
		await server.connect(b);
		await client.connect(a);
		const result = await client.callTool({
			name: "bap_generate",
			arguments: {},
		});
		expect(result.isError).toBe(true);
		expect(JSON.stringify(result)).toContain(
			"Unlock the selected encrypted account",
		);
		expect(generate).not.toHaveBeenCalled();
	} finally {
		generate.mockRestore();
		await client.close();
		await server.close();
		if (password === undefined) delete process.env.BSV_MCP_PASSWORD;
		else process.env.BSV_MCP_PASSWORD = password;
	}
});
