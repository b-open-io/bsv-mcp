import { expect, test } from "bun:test";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";

const protocol2026Headers = {
	"Mcp-Protocol-Version": "2026-07-28",
	"Mcp-Method": "tools/list",
};

const modernEnvelope = {
	"io.modelcontextprotocol/protocolVersion": "2026-07-28",
	"io.modelcontextprotocol/clientInfo": { name: "adapter-test", version: "1" },
	"io.modelcontextprotocol/clientCapabilities": {},
};

function request(body: unknown, headers: Record<string, string> = {}) {
	return new Request("http://localhost/api/mcp", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			...headers,
		},
		body: JSON.stringify(body),
	});
}

async function responseBody(response: Response): Promise<Record<string, any>> {
	const body = await response.text();
	if (!body.startsWith("event:")) return JSON.parse(body);
	return JSON.parse(body.split("data: ")[1].split("\n")[0]);
}

function createTestHandler() {
	return createMcpHandler(
		(server) => {
			server.registerTool(
				"proof_echo",
				{ description: "Echo the request and authenticated user", inputSchema: z.object({ message: z.string() }) },
				async (args, ctx) => ({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								message: args.message,
								userId: ctx.http?.authInfo?.extra?.userId,
							}),
						},
					],
				}),
			);
		},
		{
			serverInfo: { name: "adapter-test", version: "1" },
			capabilities: { tools: {} },
		},
	);
}

test("v2 adapter lists tools for modern requests", async () => {
	const response = await createTestHandler()(request(
		{ jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: modernEnvelope } },
		protocol2026Headers,
	));
	expect(response.status).toBe(200);
	const data = await responseBody(response);
	expect(data.error).toBeUndefined();
	expect(data.result.tools.some((tool: { name: string }) => tool.name === "proof_echo")).toBe(true);
});

test("v2 adapter keeps legacy tools/list and authenticated tools/call", async () => {
	const handler = withMcpAuth(
		createTestHandler(),
		async (_request, token) => token === "test-token"
			? { token, clientId: "test-client", scopes: [], expiresAt: Math.floor(Date.now() / 1000) + 3600, extra: { userId: "user-123" } }
			: undefined,
		{ required: true, requiredScopes: [], resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp" },
	);

	const list = await handler(request(
		{ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
		{ Authorization: "Bearer test-token", "Mcp-Protocol-Version": "2025-11-25" },
	));
	expect(list.status).toBe(200);
	const listData = await responseBody(list);
	expect(listData.result.tools.some((tool: { name: string }) => tool.name === "proof_echo")).toBe(true);

	const modernCall = await handler(request(
		{ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "proof_echo", arguments: { message: "modern" }, _meta: modernEnvelope } },
		{ Authorization: "Bearer test-token", ...protocol2026Headers, "Mcp-Method": "tools/call", "Mcp-Name": "proof_echo" },
	));
	expect(modernCall.status).toBe(200);
	const modernCallData = await responseBody(modernCall);
	expect(JSON.parse(modernCallData.result.content[0].text)).toEqual({ message: "modern", userId: "user-123" });

	const call = await handler(request(
		{ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "proof_echo", arguments: { message: "hello" } } },
		{ Authorization: "Bearer test-token", "Mcp-Protocol-Version": "2025-11-25" },
	));
	expect(call.status).toBe(200);
	const callData = await responseBody(call);
	expect(JSON.parse(callData.result.content[0].text)).toEqual({ message: "hello", userId: "user-123" });
});

test("v2 adapter returns a bearer challenge when auth is required", async () => {
	const handler = withMcpAuth(
		createTestHandler(),
		async () => undefined,
		{ required: true, requiredScopes: [], resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp" },
	);
	const response = await handler(request({ jsonrpc: "2.0", id: 4, method: "initialize", params: { protocolVersion: "2025-11-25" } }));
	expect(response.status).toBe(401);
	expect((await responseBody(response)).error).toBe("invalid_token");
});
