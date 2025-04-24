import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { getPublicKeyArgsSchema } from "./schemas";
import type { Wallet } from "./wallet";

// Use the schema imported from schemas.ts
export type GetPublicKeyArgs = z.infer<typeof getPublicKeyArgsSchema>;

/**
 * Register the getPublicKey tool
 */
export function registerGetPublicKeyTool(server: McpServer, wallet: Wallet) {
	server.tool(
		"wallet_getPublicKey",
		"Retrieves the current wallet's public key. This public key can be used for cryptographic operations like signature verification or encryption.",
		{ args: getPublicKeyArgsSchema },
		async (
			{ args }: { args: GetPublicKeyArgs },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		) => {
			try {
				const result = await wallet.getPublicKey(args);
				return { content: [{ type: "text", text: JSON.stringify(result) }] };
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);
}
