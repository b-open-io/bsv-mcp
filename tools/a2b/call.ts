import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

// Schema for invoking another agent via A2A protocol
export const a2aCallArgsSchema = z.object({
	url: z.string().url().describe("Full agent-to-agent endpoint URL"),
	method: z.string().describe("A2A method name to invoke"),
	params: z
		.record(z.any())
		.optional()
		.describe("Payload parameters for the A2A call"),
});
export type A2aCallArgs = z.infer<typeof a2aCallArgsSchema>;

/**
 * Registers the a2a_call tool for agent-to-agent HTTP/SSE calls
 */
export function registerA2aCallTool(server: McpServer) {
	server.tool(
		"a2a_call",
		"Invoke a remote agent's A2A endpoint via HTTP/SSE",
		{ args: a2aCallArgsSchema },
		async ({ args }: { args: A2aCallArgs }, extra: RequestHandlerExtra) => {
			// TODO: implement HTTP request logic (e.g., fetch, SSE)
			return {
				content: [{ type: "text", text: "Not implemented" }],
				isError: true,
			};
		},
	);
}
