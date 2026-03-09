import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Wallet } from "./wallet";

/**
 * Register the getPublicKey tool
 */
export function registerGetPublicKeyTool(server: McpServer, wallet: Wallet) {
	server.tool(
		"wallet_getPublicKey",
		"Retrieves the current wallet's public key. This public key can be used for cryptographic operations like signature verification or encryption.",
		{},
		async () => {
			try {
				const result = await wallet.getPublicKey({});
				return { content: [{ type: "text", text: JSON.stringify(result) }] };
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);
}
