import { expect, test } from "bun:test";
import { createMcpHandler } from "mcp-handler";
import { registerBsvTools } from "../tools/bsv";

// Exercise the adapter's server instance, not a separately constructed SDK server:
// an incompatible adapter can build successfully but fail on server.tool().
test("HTTP adapter registers BSV tools and answers tools/list", async () => {
	const handler = createMcpHandler(
		(server) => registerBsvTools(server),
		{ capabilities: { tools: {} } },
		{ basePath: "/api", disableSse: true },
	);
	const response = await handler(
		new Request("http://localhost/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
		}),
	);
	expect(response.status).toBe(200);
	const body = await response.text();
	const data = body.startsWith("event:")
		? JSON.parse(body.split("data: ")[1].split("\n")[0])
		: JSON.parse(body);
	expect(data.error).toBeUndefined();
	expect(data.result.tools.length).toBeGreaterThan(0);
	expect(
		data.result.tools.some(
			(tool: { name: string }) => tool.name === "bsv_getPrice",
		),
	).toBe(true);
});
