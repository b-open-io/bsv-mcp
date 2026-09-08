import { type OneSatContext, signBsm } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export function registerSignBsmTool(server: McpServer, ctx?: OneSatContext) {
	server.registerTool(
		"wallet_signBsm",
		{
			description: "Sign a message using BSM (Bitcoin Signed Message) format",
			inputSchema: z.object({
				message: z.string().describe("The message to sign"),
				encoding: z
					.enum(["utf8", "hex", "base64"])
					.optional()
					.describe("Message encoding format"),
			}),
		},
		async (params) => {
			try {
				if (!ctx) throw new Error("BRC-100 wallet context not available");
				const result = await signBsm.execute(ctx, params);
				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				};
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);
}
