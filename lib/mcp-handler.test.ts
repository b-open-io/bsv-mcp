import { expect, test } from "bun:test";
import {
	createMcpHandler,
	type McpRequestContext,
	McpServer,
} from "@modelcontextprotocol/server";
import { withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { withMcpToolExecution } from "../utils/mcpToolExecution";

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

async function responseBody(response: Response) {
	const body = await response.text();
	if (!body.startsWith("event:")) return JSON.parse(body);
	return JSON.parse(body.split("data: ")[1].split("\n")[0]);
}

interface TestState {
	readCalls: number;
	writeCalls: number;
	eras: McpRequestContext["era"][];
}

function createTestHandler(
	state: TestState = {
		readCalls: 0,
		writeCalls: 0,
		eras: [],
	},
) {
	const sdkHandler = createMcpHandler(
		(requestContext: McpRequestContext) => {
			state.eras.push(requestContext.era);
			const nativeServer = new McpServer(
				{ name: "adapter-test", version: "1" },
				{ capabilities: { tools: {} } },
			);
			const server = withMcpToolExecution(nativeServer, requestContext.era);

			server.registerTool(
				"proof_echo",
				{
					description: "Echo the request and authenticated user",
					inputSchema: z.object({ message: z.string() }),
				},
				async (args, ctx) => {
					state.writeCalls += 1;
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									message: args.message,
									userId: ctx.http?.authInfo?.extra?.userId,
								}),
							},
						],
					};
				},
			);
			server.registerTool(
				"bsv_getPrice",
				{
					description: "Read the current BSV price",
					inputSchema: z.object({ message: z.string() }),
				},
				async (args, ctx) => {
					state.readCalls += 1;
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									message: args.message,
									userId: ctx.http?.authInfo?.extra?.userId,
								}),
							},
						],
					};
				},
			);

			return server;
		},
		{ legacy: "reject" },
	);

	return (req: Request) => sdkHandler.fetch(req, { authInfo: req.auth });
}

test("v2 adapter lists tools for modern requests", async () => {
	const response = await createTestHandler()(
		request(
			{
				jsonrpc: "2.0",
				id: 1,
				method: "tools/list",
				params: { _meta: modernEnvelope },
			},
			protocol2026Headers,
		),
	);
	expect(response.status).toBe(200);
	const data = await responseBody(response);
	expect(data.error).toBeUndefined();
	expect(
		data.result.tools.some(
			(tool: { name: string }) => tool.name === "proof_echo",
		),
	).toBe(true);
});

test("adapter preserves modern callback execution and request authentication", async () => {
	const state: TestState = { readCalls: 0, writeCalls: 0, eras: [] };
	const handler = withMcpAuth(
		createTestHandler(state),
		async (_request, token) =>
			token === "test-token"
				? {
						token,
						clientId: "test-client",
						scopes: [],
						expiresAt: Math.floor(Date.now() / 1000) + 3600,
						extra: { userId: "user-123" },
					}
				: undefined,
		{
			required: true,
			requiredScopes: [],
			resourceMetadataPath: "/.well-known/oauth-protected-resource",
		},
	);

	const list = await handler(
		request(
			{ jsonrpc: "2.0", id: 2, method: "tools/list", params: { _meta: modernEnvelope } },
			{
				Authorization: "Bearer test-token",
				...protocol2026Headers,
			},
		),
	);
	expect(list.status).toBe(200);
	const listData = await responseBody(list);
	expect(
		listData.result.tools.some(
			(tool: { name: string }) => tool.name === "proof_echo",
		),
	).toBe(true);

	const modernRead = await handler(
		request(
			{
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: {
					name: "bsv_getPrice",
					arguments: { message: "modern-read" },
					_meta: modernEnvelope,
				},
			},
			{
				Authorization: "Bearer test-token",
				...protocol2026Headers,
				"Mcp-Method": "tools/call",
				"Mcp-Name": "bsv_getPrice",
			},
		),
	);
	expect(modernRead.status).toBe(200);
	const modernReadData = await responseBody(modernRead);
	expect(JSON.parse(modernReadData.result.content[0].text)).toEqual({
		message: "modern-read",
		userId: "user-123",
	});
	expect(modernReadData.error).toBeUndefined();

	const modernWrite = await handler(
		request(
			{
				jsonrpc: "2.0",
				id: 4,
				method: "tools/call",
				params: {
					name: "proof_echo",
					arguments: { message: "modern-write" },
					_meta: modernEnvelope,
				},
			},
			{
				Authorization: "Bearer test-token",
				...protocol2026Headers,
				"Mcp-Method": "tools/call",
				"Mcp-Name": "proof_echo",
			},
		),
	);
	expect(modernWrite.status).toBe(200);
	const modernWriteData = await responseBody(modernWrite);
	expect(modernWriteData.result.isError).not.toBe(true);
	expect(JSON.parse(modernWriteData.result.content[0].text)).toEqual({
		message: "modern-write",
		userId: "user-123",
	});
	expect(state.writeCalls).toBe(1);

	expect(state.readCalls).toBe(1);
	expect(state.eras).toEqual(["modern", "modern", "modern"]);
});

test("v2 adapter returns a bearer challenge when auth is required", async () => {
	const handler = withMcpAuth(createTestHandler(), async () => undefined, {
		required: true,
		requiredScopes: [],
		resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
	});
	const response = await handler(
		request({
			jsonrpc: "2.0",
			id: 4,
			method: "initialize",
			params: { protocolVersion: "2025-11-25" },
		}),
	);
	expect(response.status).toBe(401);
	expect((await responseBody(response)).error).toBe("invalid_token");
});
