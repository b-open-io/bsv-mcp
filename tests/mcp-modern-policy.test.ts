import { expect, spyOn, test } from "bun:test";
import { PassThrough } from "node:stream";
import {
	type CallToolResult,
	createMcpHandler,
	type McpRequestContext,
	McpServer,
} from "@modelcontextprotocol/server";
import {
	StdioServerTransport,
	serveStdio,
} from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { registerAppTool } from "../utils/mcpAppRegistration";
import { withMcpToolExecution } from "../utils/mcpToolExecution";

const MODERN_PROTOCOL_VERSION = "2026-07-28";
const LEGACY_PROTOCOL_VERSION = "2025-11-25";
const MUTATION_TOOL = "wallet_sendBsv";
const DASHBOARD_TOOL = "bsv_dashboard";

const modernEnvelope = {
	"io.modelcontextprotocol/protocolVersion": MODERN_PROTOCOL_VERSION,
	"io.modelcontextprotocol/clientInfo": {
		name: "modern-policy-wire-test",
		version: "1.0.0",
	},
	"io.modelcontextprotocol/clientCapabilities": {},
};

type JsonRpcResponse = {
	jsonrpc: "2.0";
	id: number | string | null;
	result?: {
		content?: Array<{ type: string; text?: string }>;
		isError?: boolean;
		structuredContent?: unknown;
		supportedVersions?: string[];
	};
	error?: { code?: number; message?: string };
};

function registerMutationTool(
	nativeServer: McpServer,
	era: McpRequestContext["era"],
	mutation: { run: () => CallToolResult },
) {
	const server = withMcpToolExecution(nativeServer, era);
	server.registerTool(
		MUTATION_TOOL,
		{
			description: "Synthetic wallet mutation used only by this wire test.",
			inputSchema: z.object({ destination: z.string() }),
		},
		async () => mutation.run(),
	);
	return server;
}

function makeRequest(
	body: unknown,
	headers: Record<string, string> = {},
): Request {
	return new Request("http://localhost/mcp", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			...headers,
		},
		body: JSON.stringify(body),
	});
}

async function readHttpJson(response: Response): Promise<JsonRpcResponse> {
	const body = await response.text();
	const dataLine = body
		.split(/\r?\n/)
		.find((line) => line.startsWith("data: "));
	return JSON.parse(dataLine === undefined ? body : dataLine.slice(6));
}

function modernHeaders(method: string, name?: string) {
	return {
		"Mcp-Protocol-Version": MODERN_PROTOCOL_VERSION,
		"Mcp-Method": method,
		...(name === undefined ? {} : { "Mcp-Name": name }),
	};
}

function mutationCall(id: number) {
	return {
		jsonrpc: "2.0",
		id,
		method: "tools/call",
		params: {
			name: MUTATION_TOOL,
			arguments: { destination: "1ExampleDestination" },
			_meta: modernEnvelope,
		},
	};
}

function modernDiscovery(id: number) {
	return {
		jsonrpc: "2.0",
		id,
		method: "server/discover",
		params: { _meta: modernEnvelope },
	};
}

test("negotiated modern HTTP calls execute registered mutations", async () => {
	const mutation = {
		run: () => ({
			content: [{ type: "text" as const, text: "mutation executed" }],
		}),
	};
	const mutationSpy = spyOn(mutation, "run");
	const eras: McpRequestContext["era"][] = [];
	const handler = createMcpHandler(
		(context: McpRequestContext) => {
			eras.push(context.era);
			const nativeServer = new McpServer(
				{ name: "modern-policy-http", version: "1.0.0" },
				{ capabilities: { tools: {} } },
			);
			return registerMutationTool(nativeServer, context.era, mutation);
		},
		{ legacy: "reject", responseMode: "json" },
	);

	try {
		const discovered = await handler.fetch(
			makeRequest(modernDiscovery(1), modernHeaders("server/discover")),
		);
		const discoveryBody = await readHttpJson(discovered);
		expect(discovered.status).toBe(200);
		expect(discoveryBody.error).toBeUndefined();
		expect(discoveryBody.result?.supportedVersions).toContain(
			MODERN_PROTOCOL_VERSION,
		);

		const response = await handler.fetch(
			makeRequest(mutationCall(2), modernHeaders("tools/call", MUTATION_TOOL)),
		);
		const body = await readHttpJson(response);

		expect(response.status).toBe(200);
		expect(body.error).toBeUndefined();
		expect(body.result?.isError).not.toBe(true);
		expect(body.result?.content?.[0]?.text).toContain("mutation executed");
		expect(mutationSpy).toHaveBeenCalledTimes(1);
		expect(eras).toEqual(["modern", "modern"]);
	} finally {
		await handler.close();
		mutationSpy.mockRestore();
	}
});

test("negotiated modern HTTP calls can open the dashboard and return its ready view", async () => {
	let dashboardCalls = 0;
	const eras: McpRequestContext["era"][] = [];
	const handler = createMcpHandler(
		(context: McpRequestContext) => {
			eras.push(context.era);
			const nativeServer = new McpServer(
				{ name: "modern-policy-dashboard", version: "1.0.0" },
				{ capabilities: { tools: {} } },
			);
			const server = withMcpToolExecution(nativeServer, context.era);
			registerAppTool(
				server,
				DASHBOARD_TOOL,
				{
					description: "Open the BSV dashboard.",
					inputSchema: z.object({}),
					_meta: {
						ui: { resourceUri: "ui://modern-policy/dashboard.html" },
					},
				},
				async () => {
					dashboardCalls += 1;
					return {
						content: [{ type: "text" as const, text: "BSV Dashboard opened" }],
						structuredContent: { view: "dashboard", ready: true },
					};
				},
			);
			return server;
		},
		{ legacy: "reject", responseMode: "json" },
	);

	try {
		const response = await handler.fetch(
			makeRequest(
				{
					jsonrpc: "2.0",
					id: 3,
					method: "tools/call",
					params: {
						name: DASHBOARD_TOOL,
						arguments: {},
						_meta: modernEnvelope,
					},
				},
				modernHeaders("tools/call", DASHBOARD_TOOL),
			),
		);
		const body = await readHttpJson(response);

		expect(response.status).toBe(200);
		expect(body.error).toBeUndefined();
		expect(body.result?.isError).not.toBe(true);
		expect(body.result?.content).toEqual([
			{ type: "text", text: "BSV Dashboard opened" },
		]);
		expect(body.result?.structuredContent).toEqual({
			view: "dashboard",
			ready: true,
		});
		expect(dashboardCalls).toBe(1);
		expect(eras).toEqual(["modern"]);
	} finally {
		await handler.close();
	}
});

test("negotiated modern stdio calls execute registered mutations", async () => {
	const input = new PassThrough();
	const output = new PassThrough();
	const mutation = {
		run: () => ({
			content: [{ type: "text" as const, text: "mutation executed" }],
		}),
	};
	const mutationSpy = spyOn(mutation, "run");
	const eras: McpRequestContext["era"][] = [];
	const transport = new StdioServerTransport(input, output);
	const handle = serveStdio(
		(context: McpRequestContext) => {
			eras.push(context.era);
			const nativeServer = new McpServer(
				{ name: "modern-policy-stdio", version: "1.0.0" },
				{ capabilities: { tools: {} } },
			);
			return registerMutationTool(nativeServer, context.era, mutation);
		},
		{ legacy: "serve", transport },
	);

	let buffer = "";
	const lines: string[] = [];
	const waiters: Array<(line: string) => void> = [];
	output.setEncoding("utf8");
	output.on("data", (chunk: string) => {
		buffer += chunk;
		const parts = buffer.split("\n");
		buffer = parts.pop() ?? "";
		for (const line of parts) {
			const waiter = waiters.shift();
			if (waiter) waiter(line);
			else lines.push(line);
		}
	});

	const nextResponse = async (): Promise<JsonRpcResponse> => {
		const queued = lines.shift();
		if (queued !== undefined) return JSON.parse(queued) as JsonRpcResponse;

		let timer: ReturnType<typeof setTimeout> | undefined;
		const line = await Promise.race([
			new Promise<string>((resolve) => waiters.push(resolve)),
			new Promise<never>((_, reject) => {
				timer = setTimeout(
					() => reject(new Error("Timed out waiting for stdio response")),
					5_000,
				);
			}),
		]).finally(() => {
			if (timer !== undefined) clearTimeout(timer);
		});
		return JSON.parse(line) as JsonRpcResponse;
	};

	const send = (message: unknown) => {
		input.write(`${JSON.stringify(message)}\n`);
	};

	try {
		send(modernDiscovery(1));
		const discovered = await nextResponse();
		expect(discovered.id).toBe(1);
		expect(discovered.error).toBeUndefined();
		expect(discovered.result?.supportedVersions).toContain(
			MODERN_PROTOCOL_VERSION,
		);

		send(mutationCall(2));
		const denied = await nextResponse();
		expect(denied.id).toBe(2);
		expect(denied.error).toBeUndefined();
		expect(denied.result?.isError).not.toBe(true);
		expect(denied.result?.content?.[0]?.text).toContain("mutation executed");
		expect(mutationSpy).toHaveBeenCalledTimes(1);
		expect(eras).toContain("modern");
		expect(eras).not.toContain("legacy");
	} finally {
		await handle.close();
		input.destroy();
		output.destroy();
		mutationSpy.mockRestore();
	}
});

test("legacy HTTP calls are rejected before entering a mutation callback", async () => {
	const mutation = {
		run: () => ({
			content: [{ type: "text" as const, text: "legacy mutation executed" }],
		}),
	};
	const mutationSpy = spyOn(mutation, "run");
	const eras: McpRequestContext["era"][] = [];
	const handler = createMcpHandler(
		(context: McpRequestContext) => {
			eras.push(context.era);
			const nativeServer = new McpServer(
				{ name: "modern-policy-legacy", version: "1.0.0" },
				{ capabilities: { tools: {} } },
			);
			return registerMutationTool(nativeServer, context.era, mutation);
		},
		{ legacy: "reject", responseMode: "json" },
	);

	try {
		const response = await handler.fetch(
			makeRequest(
				{
					jsonrpc: "2.0",
					id: 1,
					method: "tools/call",
					params: {
						name: MUTATION_TOOL,
						arguments: { destination: "1ExampleDestination" },
					},
				},
				{ "Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION },
			),
		);
		const body = await readHttpJson(response);

		expect(body.error?.code).toBe(-32022);
		expect(body.result).toBeUndefined();
		expect(mutationSpy).not.toHaveBeenCalled();
		expect(eras).toEqual([]);
	} finally {
		await handler.close();
		mutationSpy.mockRestore();
	}
});
