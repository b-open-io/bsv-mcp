import { expect, test } from "bun:test";
import { PrivateKey } from "@bsv/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { getPublicKeyArgsSchema } from "./schemas";
import { registerWalletTools } from "./tools";
import { Wallet } from "./wallet";

// Define type for tool names to ensure they match what's in tools.ts
type WalletToolName =
	| "wallet_getPublicKey"
	| "wallet_createSignature"
	| "wallet_verifySignature"
	| "wallet_encrypt"
	| "wallet_decrypt";

const toolNames: WalletToolName[] = [
	"wallet_getPublicKey",
	"wallet_createSignature",
	"wallet_verifySignature",
	"wallet_encrypt",
	"wallet_decrypt",
];

// Helper function to get dummy arguments for each tool
function getDummyArgs(tool: WalletToolName): Record<string, unknown> {
	switch (tool) {
		case "wallet_getPublicKey":
			return getPublicKeyArgsSchema.parse({});
		case "wallet_createSignature":
			return { data: "test", keyType: "identity" };
		case "wallet_verifySignature":
			return {
				data: "test",
				keyType: "identity",
				signature: "sig",
				publicKey: "pubkey",
			};
		case "wallet_encrypt":
			return { data: "test", publicKey: "pubkey" };
		case "wallet_decrypt":
			return { encryptedData: "data" };
		default:
			return {};
	}
}

// Bun test
for (const tool of toolNames) {
	test(`tool ${tool} returns not implemented error`, async () => {
		const server = new McpServer({ name: "Test", version: "0.0.1" });
		const wallet = new Wallet(
			PrivateKey.fromWif(
				"KyqU1boXYdksJKyxfsCtvBxfbt2a8XQd2aPhVZHNxMzvms9hRAvz",
			),
		);
		const handlers = registerWalletTools(server, wallet);

		// Get the handler for this tool
		const handler = handlers[tool];
		if (!handler) {
			throw new Error(`Tool ${tool} not registered`);
		}

		// Create a mock RequestHandlerExtra with required properties
		const mockExtra: RequestHandlerExtra = {
			signal: new AbortController().signal,
		};

		// Call the handler with dummy arguments
		const result = await handler({ args: getDummyArgs(tool) }, mockExtra);

		expect(result.isError).toBe(true);
		expect(result.content?.[0]?.text ?? "").toMatch(/not implemented/i);
	});
}
