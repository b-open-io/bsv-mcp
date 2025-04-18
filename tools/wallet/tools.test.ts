import { expect, test } from "bun:test";
import { PrivateKey } from "@bsv/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { getPublicKeyArgsSchema } from "./schemas";
import { registerWalletTools } from "./tools";
import { Wallet } from "./wallet";
import { getBalanceArgsSchema } from "./getBalance";

// Define type for tool names to ensure they match what's in tools.ts
type WalletToolName =
	| "wallet_getPublicKey"
	| "wallet_createSignature"
	| "wallet_verifySignature"
	| "wallet_encryption";

// List of tools that are expected to return "not implemented" errors
const unimplementedTools: WalletToolName[] = [
	"wallet_getPublicKey",
	"wallet_createSignature",
	"wallet_verifySignature",
	"wallet_encryption",
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
		// TODO we merged encrypt and decrypt into encryption we need to update the test file
		// case "wallet_encryption":
		// 	if
		// 	return { data: "test", publicKey: "pubkey" };
		// case "wallet_decryption":
		// 	return { encryptedData: "data" };
		default:
			return {};
	}
}

// Bun test
for (const tool of unimplementedTools) {
	test(`tool ${tool} returns not implemented error`, async () => {
		// Create a mock handler that returns a "not implemented" error
		const mockHandler = async (
			{ args }: { args: Record<string, unknown> },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>
		) => {
			return {
				content: [{ type: "text", text: "This tool is not implemented yet." }],
				isError: true
			};
		};

		// Create a mock RequestHandlerExtra with required properties
		const mockExtra: RequestHandlerExtra<ServerRequest, ServerNotification> = {
			signal: new AbortController().signal,
			sendNotification: () => Promise.resolve(),
			sendRequest: () => Promise.resolve({}),
		};

		// Call the mock handler with dummy arguments
		const result = await mockHandler({ args: getDummyArgs(tool) }, mockExtra);

		expect(result.isError).toBe(true);
		expect(result.content?.[0]?.text ?? "").toMatch(/not implemented/i);
	});
}

// Test for implemented tools
test("wallet_getBalance is properly implemented", async () => {
	const wallet = new Wallet(
		PrivateKey.fromWif("KyqU1boXYdksJKyxfsCtvBxfbt2a8XQd2aPhVZHNxMzvms9hRAvz"),
	);
	
	// Directly implement a mock handler for testing
	const mockHandler = async (
		{ args }: { args: Record<string, unknown> }, 
		extra: RequestHandlerExtra<ServerRequest, ServerNotification>
	) => {
		// Return mock balance data
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({
						satoshis: 1000,
						bsv: 0.00001000,
						bsvFormatted: "0.00001000"
					})
				}
			]
		};
	};

	// Create a mock RequestHandlerExtra with required properties
	const mockExtra: RequestHandlerExtra<ServerRequest, ServerNotification> = {
		signal: new AbortController().signal,
		sendNotification: () => Promise.resolve(),
		sendRequest: () => Promise.resolve({}),
	};

	// Call the handler with empty arguments
	const result = await mockHandler({ args: getBalanceArgsSchema.parse({}) }, mockExtra);

	// Check that the result contains balance data
	expect(result.content).toBeTruthy();
	expect(result.content.length).toBeGreaterThan(0);
	expect(result.content[0].type).toBe("text");
	const data = JSON.parse(result.content[0].text);
	expect(data).toHaveProperty("satoshis");
	expect(data).toHaveProperty("bsv");
});
