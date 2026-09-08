import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { registerAllTools, type ToolsConfig } from "../tools/index.ts";
import {
	isWalletOnboardingAvailable,
	registerWalletOnboardingTool,
	WALLET_ONBOARDING_FAILURE,
	WALLET_ONBOARDING_SUCCESS,
	WALLET_ONBOARDING_TOOL_NAME,
} from "../tools/wallet/onboarding.ts";

/**
 * Browser-backed wallet onboarding contract against the real maker API.
 *
 * Actual surface in `tools/wallet/onboarding.ts`:
 * `registerWalletOnboardingTool(server, openWalletSetup)` takes the opener
 * callback directly, gated by `isWalletOnboardingAvailable(config)` on the
 * `walletSetupNeeded` + `openWalletSetup` pair. The tool opens setup only
 * when `wallet_onboarding` is called and returns only public status.
 */

const SECRET_SETUP_URL = "https://127.0.0.1:9/setup#setup-token-secret-abc123";
const SECRET_TOKEN = "setup-token-secret-abc123";
const SECRET_WIF = "KzSecretWifPrivateKey987654321abcdef";
const SECRET_PASSPHRASE = "secret onboarding passphrase horse battery";
const SECRET_ERROR = "callback-boom-secret-error-99xyz";

const SECRETS = [
	SECRET_SETUP_URL,
	SECRET_TOKEN,
	SECRET_WIF,
	SECRET_PASSPHRASE,
	SECRET_ERROR,
];

function makeResolvingOpener() {
	const spy = {
		calls: 0,
		async open() {
			spy.calls += 1;
			// Capture sensitive material internally; the MCP result must not echo it.
			const _captured = {
				url: SECRET_SETUP_URL,
				token: SECRET_TOKEN,
				privateKey: SECRET_WIF,
				passphrase: SECRET_PASSPHRASE,
			};
			void _captured;
		},
	};
	return spy;
}

function makeRejectingOpener() {
	const spy = {
		calls: 0,
		async open() {
			spy.calls += 1;
			const _captured = {
				url: SECRET_SETUP_URL,
				token: SECRET_TOKEN,
				privateKey: SECRET_WIF,
				passphrase: SECRET_PASSPHRASE,
			};
			void _captured;
			throw new Error(`opener failed: ${SECRET_ERROR}`);
		},
	};
	return spy;
}

function expectNoSecrets(value: unknown): void {
	const body = typeof value === "string" ? value : JSON.stringify(value);
	for (const secret of SECRETS) expect(body).not.toContain(secret);
}

function quietCategories(): ToolsConfig {
	return {
		enableBsvTools: false,
		enableOrdinalsTools: false,
		enableUtilsTools: false,
		enableBapTools: false,
		enableBsocialTools: false,
		enableWalletTools: false,
		enableMneeTools: false,
		disableBroadcasting: true,
	};
}

async function withMcpClient<T>(
	server: McpServer,
	run: (client: Client) => Promise<T>,
): Promise<T> {
	const [serverTransport, clientTransport] =
		InMemoryTransport.createLinkedPair();
	const client = new Client({
		name: "onboarding-browser-contract-client",
		version: "1.0.0",
	});
	await server.connect(serverTransport);
	await client.connect(clientTransport);
	try {
		return await run(client);
	} finally {
		await client.close();
		await server.close();
	}
}

function toolNames(tools: { name: string }[]): string[] {
	return tools.map((tool) => tool.name);
}

test("wallet_onboarding opens setup exactly once per call with safe public success", async () => {
	const opener = makeResolvingOpener();
	const server = new McpServer(
		{
			name: "onboarding-browser-contract",
			version: "1.0.0",
		},
		{ capabilities: { tools: {} } },
	);
	registerWalletOnboardingTool(server, opener.open);
	expect(opener.calls).toBe(0);

	await withMcpClient(server, async (client) => {
		const listed = await client.listTools();
		expect(toolNames(listed.tools)).toContain(WALLET_ONBOARDING_TOOL_NAME);
		expect(opener.calls).toBe(0);

		const first = await client.callTool({
			name: WALLET_ONBOARDING_TOOL_NAME,
			arguments: {},
		});
		expect(opener.calls).toBe(1);
		expect(first.isError).toBe(false);
		expect(first.structuredContent).toEqual({ ...WALLET_ONBOARDING_SUCCESS });
		expect(first.structuredContent).toMatchObject({
			status: "opened",
			setupNeeded: true,
		});
		expect((first.structuredContent as Record<string, unknown>).nextStep).toBe(
			WALLET_ONBOARDING_SUCCESS.nextStep,
		);
		expectNoSecrets(first.content);
		expectNoSecrets(first.structuredContent);

		const second = await client.callTool({
			name: WALLET_ONBOARDING_TOOL_NAME,
			arguments: {},
		});
		expect(opener.calls).toBe(2);
		expect(second.isError).toBe(false);
		expect(second.structuredContent).toEqual({ ...WALLET_ONBOARDING_SUCCESS });
		expectNoSecrets(second.content);
		expectNoSecrets(second.structuredContent);
	});
});

test("wallet_onboarding failure returns safe generic error without callback material", async () => {
	const opener = makeRejectingOpener();
	const server = new McpServer(
		{
			name: "onboarding-browser-contract-failure",
			version: "1.0.0",
		},
		{ capabilities: { tools: {} } },
	);
	registerWalletOnboardingTool(server, opener.open);
	expect(opener.calls).toBe(0);

	await withMcpClient(server, async (client) => {
		expect(toolNames((await client.listTools()).tools)).toContain(
			WALLET_ONBOARDING_TOOL_NAME,
		);
		expect(opener.calls).toBe(0);

		const result = await client.callTool({
			name: WALLET_ONBOARDING_TOOL_NAME,
			arguments: {},
		});
		expect(opener.calls).toBe(1);
		expect(result.isError).toBe(true);
		expect(result.structuredContent).toEqual({ ...WALLET_ONBOARDING_FAILURE });
		expect(result.structuredContent).toMatchObject({
			status: "error",
			setupNeeded: true,
			message: WALLET_ONBOARDING_FAILURE.message,
		});
		expectNoSecrets(result.content);
		expectNoSecrets(result.structuredContent);
	});
});

test("wallet onboarding availability requires the needed + opener pair", () => {
	const opener = makeResolvingOpener();
	expect(
		isWalletOnboardingAvailable({
			walletSetupNeeded: true,
			openWalletSetup: opener.open,
		}),
	).toBe(true);
	expect(isWalletOnboardingAvailable({ walletSetupNeeded: false })).toBe(false);
	expect(isWalletOnboardingAvailable({})).toBe(false);
	expect(isWalletOnboardingAvailable({ walletSetupNeeded: true })).toBe(false);
	expect(
		isWalletOnboardingAvailable({
			walletSetupNeeded: false,
			openWalletSetup: opener.open,
		}),
	).toBe(false);
	expect(opener.calls).toBe(0);
});

test("registerAllTools gates wallet_onboarding on needed + opener pair", async () => {
	const neededOpener = makeResolvingOpener();
	const neededServer = new McpServer(
		{
			name: "onboarding-gate-needed",
			version: "1.0.0",
		},
		{ capabilities: { tools: {} } },
	);
	registerAllTools(neededServer, {
		...quietCategories(),
		walletSetupNeeded: true,
		openWalletSetup: neededOpener.open,
	});
	await withMcpClient(neededServer, async (client) => {
		expect(toolNames((await client.listTools()).tools)).toContain(
			WALLET_ONBOARDING_TOOL_NAME,
		);
		expect(neededOpener.calls).toBe(0);
		const result = await client.callTool({
			name: WALLET_ONBOARDING_TOOL_NAME,
			arguments: {},
		});
		expect(neededOpener.calls).toBe(1);
		expect(result.isError).toBe(false);
		expect(result.structuredContent).toEqual({ ...WALLET_ONBOARDING_SUCCESS });
		expectNoSecrets(result.content);
		expectNoSecrets(result.structuredContent);
	});

	const completedOpener = makeResolvingOpener();
	const completedServer = new McpServer(
		{
			name: "onboarding-gate-completed",
			version: "1.0.0",
		},
		{ capabilities: { tools: {} } },
	);
	registerAllTools(completedServer, {
		...quietCategories(),
		walletSetupNeeded: false,
		openWalletSetup: completedOpener.open,
	});
	await withMcpClient(completedServer, async (client) => {
		expect(toolNames((await client.listTools()).tools)).not.toContain(
			WALLET_ONBOARDING_TOOL_NAME,
		);
	});
	expect(completedOpener.calls).toBe(0);

	const missingOpener = makeResolvingOpener();
	const missingServer = new McpServer(
		{
			name: "onboarding-gate-missing-opener",
			version: "1.0.0",
		},
		{ capabilities: { tools: {} } },
	);
	registerAllTools(missingServer, {
		...quietCategories(),
		walletSetupNeeded: true,
	});
	await withMcpClient(missingServer, async (client) => {
		expect(toolNames((await client.listTools()).tools)).not.toContain(
			WALLET_ONBOARDING_TOOL_NAME,
		);
	});
	expect(missingOpener.calls).toBe(0);
});
