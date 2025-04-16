import { expect, test } from "bun:test";
import { PrivateKey } from "@bsv/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerWalletTools } from "../../tools/wallet/tools";
import { Wallet } from "../../tools/wallet/wallet";

// List of expected wallet tool names
const EXPECTED_WALLET_TOOLS = [
	"wallet_getPublicKey",
	"wallet_createSignature",
	"wallet_verifySignature",
	"wallet_encrypt",
	"wallet_decrypt",
	"wallet_createAction",
	"wallet_signAction",
	"wallet_listActions",
	"wallet_listOutputs",
	"wallet_getNetwork",
	"wallet_getVersion",
	"wallet_revealCounterpartyKeyLinkage",
	"wallet_revealSpecificKeyLinkage",
	"wallet_createHmac",
	"wallet_verifyHmac",
	"wallet_abortAction",
	"wallet_internalizeAction",
	"wallet_relinquishOutput",
	"wallet_acquireCertificate",
	"wallet_listCertificates",
	"wallet_proveCertificate",
	"wallet_relinquishCertificate",
	"wallet_discoverByIdentityKey",
	"wallet_discoverByAttributes",
	"wallet_isAuthenticated",
	"wallet_waitForAuthentication",
	"wallet_getHeaderForHeight",
];

// Mock wallet with test responses
class TestWallet extends Wallet {
	constructor() {
		super(PrivateKey.fromRandom());
	}

	// Override with test implementations that actually return something
	async getPublicKey() {
		return { publicKey: "mockPublicKey123" };
	}

	// Note: other methods will still return 'not implemented' errors
}

test("MCP server registers all expected wallet tools", async () => {
	// Create an MCP server
	const server = new McpServer({
		name: "Wallet Server Test",
		version: "0.0.1",
	});

	// Create test wallet and register tools
	const wallet = new TestWallet();
	const handlers = registerWalletTools(server, wallet);

	// Check that we have all expected tool handlers
	for (const toolName of EXPECTED_WALLET_TOOLS) {
		expect(handlers[toolName as keyof typeof handlers]).toBeDefined();
		expect(typeof handlers[toolName as keyof typeof handlers]).toBe("function");
	}

	// Check that we don't have any unexpected handlers
	const actualToolNames = Object.keys(handlers);
	expect(actualToolNames.length).toBe(EXPECTED_WALLET_TOOLS.length);

	for (const toolName of actualToolNames) {
		expect(EXPECTED_WALLET_TOOLS).toContain(toolName);
	}
});

test("MCP server with wallet tools", async () => {
	// Create an MCP server
	const server = new McpServer({
		name: "Wallet Server Test",
		version: "0.0.1",
	});

	// Create test wallet and register tools
	const wallet = new TestWallet();
	const handlers = registerWalletTools(server, wallet);

	// Mock the request handler extra
	const mockExtra = {
		signal: new AbortController().signal,
	};

	// Test the overridden getPublicKey handler which should return data
	const getPublicKeyHandler = handlers.wallet_getPublicKey;
	const getPublicKeyResult = await getPublicKeyHandler({ args: {} }, mockExtra);

	// Check the success result based on the actual structure
	expect(getPublicKeyResult.content).toBeDefined();
	expect(getPublicKeyResult.content?.[0]?.type).toBe("text");

	const publicKeyContent = getPublicKeyResult.content?.[0]?.text;
	if (typeof publicKeyContent === "string") {
		expect(JSON.parse(publicKeyContent)).toEqual({
			publicKey: "mockPublicKey123",
		});
	}
});

// For a more complete integration test, we could create a real HTTP server
// and use fetch to make requests to it
test.skip("MCP server with HTTP requests", async () => {
	// Create MCP server
	const server = new McpServer({
		name: "Wallet Server Test",
		version: "0.0.1",
	});

	// Register wallet tools
	const wallet = new TestWallet();
	const handlers = registerWalletTools(server, wallet);

	// Define expected request type
	type ToolCallRequest = {
		type: string;
		name: string;
		args?: Record<string, unknown>;
	};

	// Create a simple HTTP server
	const httpServer = Bun.serve({
		port: 0, // Use random available port
		async fetch(req) {
			if (req.method === "POST") {
				const bodyText = await req.text();
				let body: unknown;

				try {
					body = JSON.parse(bodyText);
				} catch (err) {
					return new Response("Invalid JSON", { status: 400 });
				}

				// Type guard for the request body
				const isToolCallRequest = (obj: unknown): obj is ToolCallRequest => {
					return (
						typeof obj === "object" &&
						obj !== null &&
						"type" in obj &&
						"name" in obj &&
						typeof (obj as ToolCallRequest).type === "string" &&
						typeof (obj as ToolCallRequest).name === "string"
					);
				};

				// Handle MCP requests by calling the appropriate tool
				if (
					isToolCallRequest(body) &&
					body.type === "tool_call" &&
					body.name.startsWith("wallet_")
				) {
					// Get handler from our handlers object
					const toolName = body.name as keyof typeof handlers;
					const handler = handlers[toolName];
					if (handler) {
						const result = await handler(
							{ args: body.args || {} },
							{
								signal: new AbortController().signal,
							},
						);

						return new Response(JSON.stringify(result), {
							headers: { "Content-Type": "application/json" },
						});
					}
				}
			}

			return new Response("Not found", { status: 404 });
		},
	});

	try {
		const port = httpServer.port;
		const baseUrl = `http://localhost:${port}`;

		// Test calling the getPublicKey tool
		const response = await fetch(`${baseUrl}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "tool_call",
				name: "wallet_getPublicKey",
				args: {},
			}),
		});

		const resultData = (await response.json()) as {
			isError?: boolean;
			content?: Array<{ type: string; text: string }>;
		};

		expect(resultData.content).toBeDefined();
		expect(resultData.content?.[0]?.type).toBe("text");

		if (resultData.content?.[0]?.text) {
			const parsedContent = JSON.parse(resultData.content[0].text);
			expect(parsedContent).toEqual({ publicKey: "mockPublicKey123" });
		}
	} finally {
		// Shutdown the server
		httpServer.stop();
	}
});
