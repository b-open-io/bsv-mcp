import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { registerAppTool } from "./mcpAppRegistration";
import { elicitMcpForm, McpApprovalFlow } from "./mcpApprovalFlow";
import { withMcpToolExecution } from "./mcpToolExecution";

test("modern MCP App tool approvals use embedded input requests and preserve schema validation", async () => {
	const flow = new McpApprovalFlow();
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	let executed = 0;
	let prompted = 0;
	const handle = serveStdio(
		(context) => {
			const server = withMcpToolExecution(
				new McpServer({ name: "app-execution-test", version: "1" }),
				context.era,
				flow,
			);
			registerAppTool(
				server,
				"app_sweep_broadcast",
				{
					inputSchema: z.object({ reference: z.string().min(1) }),
					_meta: { ui: { resourceUri: "ui://test/app" } },
				},
				async ({ reference }) => {
					const answer = await elicitMcpForm({
						message: `Approve ${reference}?`,
						requestedSchema: {
							type: "object",
							properties: { approved: { type: "boolean" } },
							required: ["approved"],
						},
					});
					if (answer.action !== "accept" || answer.content?.approved !== true)
						throw new Error("Declined");
					executed++;
					return { content: [{ type: "text", text: reference }] };
				},
			);
			return server;
		},
		{ transport: serverTransport, legacy: "reject" },
	);
	const client = new Client(
		{ name: "modern-app-client", version: "1" },
		{
			versionNegotiation: { mode: "auto" },
			capabilities: { elicitation: { form: {} } },
		},
	);
	client.setRequestHandler("elicitation/create", async () => {
		prompted++;
		return { action: "accept", content: { approved: true } };
	});
	try {
		await client.connect(clientTransport);
		const invalid = await client.callTool({
			name: "app_sweep_broadcast",
			arguments: { reference: "" },
		});
		expect(invalid.isError).toBe(true);
		expect(prompted).toBe(0);
		const valid = await client.callTool({
			name: "app_sweep_broadcast",
			arguments: { reference: "synthetic-reference" },
		});
		expect(valid.content).toEqual([
			{ type: "text", text: "synthetic-reference" },
		]);
		expect(executed).toBe(1);
		expect(prompted).toBe(1);
	} finally {
		await client.close();
		await handle.close();
		flow.close();
	}
});
