import { expect, test } from "bun:test";
import {
	type CallToolResult,
	createMcpHandler,
	McpServer,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { McpApprovalFlow, requestScopedElicitation } from "./mcpApprovalFlow";

type ResponseBody = {
	result?: {
		resultType?: string;
		requestState?: string;
		inputRequests?: Record<string, unknown>;
		isError?: boolean;
		content?: Array<{ text?: string }>;
	};
	error?: { message: string };
};

function fixture(
	options: { ttlMs?: number; twice?: boolean; signal?: AbortSignal } = {},
) {
	const flow = new McpApprovalFlow(options.ttlMs);
	let calls = 0;
	let writes = 0;
	let declines = 0;
	const handler = createMcpHandler(
		() => {
			const server = new McpServer({
				name: "approval-wire-test",
				version: "1",
			});
			server.registerTool(
				"spend",
				{ inputSchema: z.object({ satoshis: z.number() }) },
				(args, ctx) =>
					flow.run("spend", args, ctx, true, async () => {
						calls++;
						for (let i = 0; i < (options.twice ? 2 : 1); i++) {
							const response = await requestScopedElicitation(
								{
									message: `Approve ${args.satoshis} sats, step ${i + 1}?`,
									requestedSchema: {
										type: "object",
										properties: { approved: { type: "boolean" } },
										required: ["approved"],
									},
								},
								options.signal,
							);
							if (
								response?.action !== "accept" ||
								response.content?.approved !== true
							) {
								declines++;
								return {
									isError: true,
									content: [{ type: "text", text: "declined" }],
								};
							}
						}
						writes++;
						return {
							content: [{ type: "text", text: `sent ${args.satoshis}` }],
						} satisfies CallToolResult;
					}),
			);
			return server;
		},
		{ legacy: "reject" },
	);
	let requestId = 0;
	return {
		counts: () => ({ calls, writes, declines }),
		async call(
			extra: Record<string, unknown> = {},
			user = "alice",
			satoshis = 12,
			form = true,
		): Promise<ResponseBody> {
			const response = await handler.fetch(
				new Request("http://localhost/mcp", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json, text/event-stream",
						"Mcp-Protocol-Version": "2026-07-28",
						"Mcp-Method": "tools/call",
						"Mcp-Name": "spend",
					},
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: ++requestId,
						method: "tools/call",
						params: {
							name: "spend",
							arguments: { satoshis },
							...extra,
							_meta: {
								"io.modelcontextprotocol/protocolVersion": "2026-07-28",
								"io.modelcontextprotocol/clientInfo": {
									name: "test",
									version: "1",
								},
								"io.modelcontextprotocol/clientCapabilities": form
									? { elicitation: { form: {} } }
									: {},
							},
						},
					}),
				}),
				{
					authInfo: { token: "synthetic", clientId: user, scopes: ["wallet"] },
				},
			);
			const text = await response.text();
			return JSON.parse(
				text
					.split(/\r?\n/)
					.find((line) => line.startsWith("data: "))
					?.slice(6) ?? text,
			);
		},
		async close() {
			flow.close();
			await handler.close();
		},
	};
}

const accepted = {
	approval: { action: "accept", content: { approved: true } },
};

test("modern wire approval resumes one operation and caches duplicate settlement", async () => {
	const f = fixture();
	try {
		const first = await f.call();
		expect(first.result?.resultType).toBe("input_required");
		expect(first.result?.inputRequests?.approval).toBeDefined();
		expect(f.counts()).toEqual({ calls: 1, writes: 0, declines: 0 });
		const retry = {
			requestState: first.result?.requestState,
			inputResponses: accepted,
		};
		const results = await Promise.all([f.call(retry), f.call(retry)]);
		for (const result of results)
			expect(result.result?.content?.[0]?.text).toBe("sent 12");
		expect(f.counts()).toEqual({ calls: 1, writes: 1, declines: 0 });
	} finally {
		await f.close();
	}
});

test("modern approval rejects forged state, changed arguments, and another principal", async () => {
	const f = fixture();
	try {
		const first = await f.call();
		const retry = {
			requestState: first.result?.requestState,
			inputResponses: accepted,
		};
		for (const result of [
			await f.call({ inputResponses: accepted }),
			await f.call({ ...retry, requestState: `${retry.requestState}x` }),
			await f.call(retry, "bob"),
			await f.call(retry, "alice", 13),
		])
			expect(result.result?.isError || result.error).toBeTruthy();
		expect(f.counts().writes).toBe(0);
		expect((await f.call(retry)).result?.content?.[0]?.text).toBe("sent 12");
	} finally {
		await f.close();
	}
});

for (const response of [
	{ action: "decline" },
	{ action: "cancel" },
	{ action: "accept", content: { approved: "true" } },
]) {
	test(`modern approval refuses ${JSON.stringify(response)} without spending`, async () => {
		const f = fixture();
		try {
			const first = await f.call();
			const result = await f.call({
				requestState: first.result?.requestState,
				inputResponses: { approval: response },
			});
			expect(result.result?.isError).toBe(true);
			expect(f.counts()).toEqual({ calls: 1, writes: 0, declines: 1 });
		} finally {
			await f.close();
		}
	});
}

test("each spending callback needs its own round; an old approval cannot approve a later one", async () => {
	const f = fixture({ twice: true });
	try {
		const first = await f.call();
		const retry = {
			requestState: first.result?.requestState,
			inputResponses: accepted,
		};
		const second = await f.call(retry);
		expect(second.result?.resultType).toBe("input_required");
		const stale = await f.call(retry);
		expect(stale.result?.resultType).toBe("input_required");
		expect(f.counts().writes).toBe(0);
		const final = await f.call({
			requestState: second.result?.requestState,
			inputResponses: accepted,
		});
		expect(final.result?.content?.[0]?.text).toBe("sent 12");
		expect(f.counts().calls).toBe(1);
	} finally {
		await f.close();
	}
});

test("expiry cancels a suspended operation and its continuation cannot restart it", async () => {
	const f = fixture({ ttlMs: 25 });
	try {
		const first = await f.call();
		await new Promise((resolve) => setTimeout(resolve, 60));
		const result = await f.call({
			requestState: first.result?.requestState,
			inputResponses: accepted,
		});
		expect(result.result?.isError || result.error).toBeTruthy();
		expect(f.counts()).toEqual({ calls: 1, writes: 0, declines: 1 });
	} finally {
		await f.close();
	}
});

test("wallet-session revocation cancels pending modern input before a late acceptance", async () => {
	const session = new AbortController();
	const f = fixture({ signal: session.signal });
	try {
		const first = await f.call();
		session.abort();
		const result = await f.call({
			requestState: first.result?.requestState,
			inputResponses: accepted,
		});
		expect(result.result?.isError).toBe(true);
		expect(f.counts()).toEqual({ calls: 1, writes: 0, declines: 1 });
	} finally {
		await f.close();
	}
});
