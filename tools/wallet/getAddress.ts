import { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register the tool to get the wallet address
 * @param server The MCP server instance
 */
export function registerGetAddressTool(server: McpServer): void {
	server.tool(
		"wallet_getAddress",
		{
			args: z.object({}).optional(),
		},
		async () => {
			try {
				const wif = process.env.PRIVATE_KEY_WIF;
				if (!wif) throw new Error("PRIVATE_KEY_WIF env var not set");
				const privKey = PrivateKey.fromWif(wif);
				const address = privKey.toAddress();
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ address, status: "ok" }),
						},
					],
				};
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return {
					content: [{ type: "text", text: msg }],
					isError: true,
				};
			}
		},
	);
}
