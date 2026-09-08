import { afterEach, describe, expect, it } from "bun:test";
import type {
	CallToolResult,
	McpServer,
	ServerContext,
} from "@modelcontextprotocol/server";
import { registerSendMneeTool, type SendMneeArgs } from "./sendMnee";

type ToolHandler = (
	args: SendMneeArgs,
	extra: ServerContext,
) => Promise<CallToolResult>;

function captureSendHandler() {
	let handler: ToolHandler | undefined;
	const server = {
		registerTool(_name: string, _config: unknown, callback: ToolHandler) {
			handler = callback;
		},
	} as unknown as McpServer;

	return {
		server,
		call(args: SendMneeArgs) {
			if (!handler) throw new Error("send handler was not registered");
			return handler(args, {} as ServerContext);
		},
	};
}

const originalWif = process.env.PRIVATE_KEY_WIF;
const originalBroadcasting = process.env.DISABLE_BROADCASTING;

afterEach(() => {
	if (originalWif === undefined) delete process.env.PRIVATE_KEY_WIF;
	else process.env.PRIVATE_KEY_WIF = originalWif;
	if (originalBroadcasting === undefined)
		delete process.env.DISABLE_BROADCASTING;
	else process.env.DISABLE_BROADCASTING = originalBroadcasting;
});

describe("mnee_sendMnee initialization guards", () => {
	it("does not initialize the service when the private key is missing", async () => {
		delete process.env.PRIVATE_KEY_WIF;
		delete process.env.DISABLE_BROADCASTING;
		let providerCalls = 0;
		const { server, call } = captureSendHandler();
		registerSendMneeTool(server, async () => {
			providerCalls += 1;
			throw new Error("service should not initialize");
		});

		const result = await call({
			address: "mock-address",
			amount: 1,
			currency: "MNEE",
		});

		expect(providerCalls).toBe(0);
		expect(result.isError).toBe(true);
		expect(JSON.stringify(result.content)).toContain(
			"No private key available",
		);
	});

	it("does not initialize the service when broadcasting is disabled", async () => {
		process.env.PRIVATE_KEY_WIF = "mock-wif";
		process.env.DISABLE_BROADCASTING = "true";
		let providerCalls = 0;
		const { server, call } = captureSendHandler();
		registerSendMneeTool(server, async () => {
			providerCalls += 1;
			throw new Error("service should not initialize");
		});

		const result = await call({
			address: "mock-address",
			amount: 1,
			currency: "MNEE",
		});

		expect(providerCalls).toBe(0);
		expect(result.isError).toBe(true);
		expect(JSON.stringify(result.content)).toContain("DISABLE_BROADCASTING");
	});
});
