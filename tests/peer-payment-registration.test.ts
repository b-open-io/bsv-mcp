import { describe, expect, mock, test } from "bun:test";
import type { OneSatContext } from "@1sat/actions";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import {
	buildCompactFamilies,
	getCompactCapabilityMetadata,
	registerCompactCatalog,
} from "../tools/compactCatalog";
import { registerAllTools, type ToolsConfig } from "../tools/index";
import type { Wallet } from "../tools/wallet/wallet";

const embeddedCtx = {
	wallet: {},
	services: {},
	chain: "main",
	isBaseWallet: true,
} as unknown as OneSatContext;

const derivedExternalCtx = {
	wallet: {},
	services: {},
	chain: "main",
	isBaseWallet: false,
} as unknown as OneSatContext;

const droplitWallet = {
	isDroplitMode: true,
	getDroplitClient: () => undefined,
} as unknown as NonNullable<ToolsConfig["integratedWallet"]>;

const fakeWallet = {} as Wallet;

function fullConfig(overrides: Partial<ToolsConfig> = {}): ToolsConfig {
	return {
		enableBsvTools: false,
		enableOrdinalsTools: false,
		enableUtilsTools: false,
		enableBapTools: false,
		enableBsocialTools: false,
		enableMneeTools: false,
		enableWalletTools: true,
		...overrides,
	};
}

function compactConfig(overrides: Partial<ToolsConfig> = {}): ToolsConfig {
	return {
		...fullConfig(overrides),
		toolCatalog: "compact",
	};
}

async function listTools(
	register: (server: McpServer) => void,
	clientName: string,
) {
	const server = new McpServer({ name: "peer-payment-test", version: "1.0.0" });
	register(server);
	const client = new Client({ name: clientName, version: "1.0.0" });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await server.connect(serverTransport);
	await client.connect(clientTransport);
	try {
		return (await client.listTools()).tools;
	} finally {
		await client.close();
		await server.close();
	}
}

function operationEnum(
	tool: Awaited<ReturnType<Client["listTools"]>>["tools"][number],
): string[] {
	const schema = tool.inputSchema as {
		properties?: { operation?: { enum?: string[] } };
	};
	return schema.properties?.operation?.enum ?? [];
}

describe("wallet_peerPayments full-catalog wiring", () => {
	test("registers with mutating annotations for an embedded ctx", async () => {
		const tools = await listTools(
			(server) => registerAllTools(server, fullConfig({ ctx: embeddedCtx })),
			"peer-full-embedded",
		);
		const peer = tools.find((tool) => tool.name === "wallet_peerPayments");
		if (!peer) throw new Error("Expected wallet_peerPayments in tools/list");
		expect(peer.annotations?.readOnlyHint).toBe(false);
		expect(peer.annotations?.destructiveHint).toBe(true);
		expect(peer.annotations?.idempotentHint).toBe(false);
		expect(peer.annotations?.openWorldHint).toBe(true);
	});

	test("does not register for explicit external signer mode", async () => {
		const tools = await listTools(
			(server) =>
				registerAllTools(
					server,
					fullConfig({ ctx: embeddedCtx, externalWallet: true }),
				),
			"peer-full-external",
		);
		expect(tools.map((tool) => tool.name)).not.toContain("wallet_peerPayments");
	});

	test("does not register for ctx-derived external signer mode", async () => {
		const tools = await listTools(
			(server) =>
				registerAllTools(server, fullConfig({ ctx: derivedExternalCtx })),
			"peer-full-derived-external",
		);
		expect(tools.map((tool) => tool.name)).not.toContain("wallet_peerPayments");
	});

	test("does not register in project payments-only scope", async () => {
		const tools = await listTools(
			(server) =>
				registerAllTools(
					server,
					fullConfig({ ctx: embeddedCtx, walletScope: "payments" }),
				),
			"peer-full-payments-scope",
		);
		expect(tools.map((tool) => tool.name)).not.toContain("wallet_peerPayments");
	});

	test("does not register in Droplit mode", async () => {
		const tools = await listTools(
			(server) =>
				registerAllTools(
					server,
					fullConfig({ ctx: embeddedCtx, integratedWallet: droplitWallet }),
				),
			"peer-full-droplit",
		);
		expect(tools.map((tool) => tool.name)).not.toContain("wallet_peerPayments");
	});

	test("does not register without a BRC-100 ctx", async () => {
		const tools = await listTools(
			(server) => registerAllTools(server, fullConfig({ wallet: fakeWallet })),
			"peer-full-walletless",
		);
		expect(tools.map((tool) => tool.name)).not.toContain("wallet_peerPayments");
	});

	test("does not register when wallet tools are disabled", async () => {
		const tools = await listTools(
			(server) =>
				registerAllTools(
					server,
					fullConfig({ ctx: embeddedCtx, enableWalletTools: false }),
				),
			"peer-full-disabled",
		);
		expect(tools.map((tool) => tool.name)).not.toContain("wallet_peerPayments");
	});

	test("registration makes no network calls", async () => {
		const originalFetch = globalThis.fetch;
		const fetchSpy = mock(async () => {
			throw new Error("network call during registration");
		});
		globalThis.fetch = fetchSpy as unknown as typeof fetch;
		try {
			const server = new McpServer({
				name: "peer-full-no-network",
				version: "1.0.0",
			});
			registerAllTools(server, fullConfig({ ctx: embeddedCtx }));
			expect(fetchSpy).not.toHaveBeenCalled();
			await server.close();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

describe("wallet_payments compact wiring", () => {
	test("exposes the combined list|receive operation outside wallet_read", async () => {
		const tools = await listTools(
			(server) =>
				registerCompactCatalog(server, compactConfig({ ctx: embeddedCtx })),
			"peer-compact-embedded",
		);
		const payments = tools.find((tool) => tool.name === "wallet_payments");
		if (!payments) throw new Error("Expected wallet_payments in tools/list");
		expect(operationEnum(payments)).toEqual(["wallet_peerPayments"]);
		expect(payments.annotations?.readOnlyHint).toBe(false);
		expect(payments.annotations?.destructiveHint).toBe(true);
		expect(payments.annotations?.idempotentHint).toBe(false);
		expect(payments.annotations?.openWorldHint).toBe(true);

		const walletRead = tools.find((tool) => tool.name === "wallet_read");
		if (!walletRead) throw new Error("Expected wallet_read in tools/list");
		expect(operationEnum(walletRead)).not.toContain("wallet_peerPayments");
		expect(walletRead.annotations?.readOnlyHint).toBe(true);

		const families = buildCompactFamilies(compactConfig({ ctx: embeddedCtx }));
		expect(families.map((family) => family.name)).toContain("wallet_payments");
		const family = families.find(
			(candidate) => candidate.name === "wallet_payments",
		);
		if (!family) throw new Error("Expected wallet_payments family");
		expect(family.annotations.readOnlyHint).toBe(false);
		expect(family.annotations.destructiveHint).toBe(true);
		expect(family.annotations.idempotentHint).toBe(false);
		expect(family.annotations.openWorldHint).toBe(true);
	});

	test("does not register for explicit external signer mode", async () => {
		const tools = await listTools(
			(server) =>
				registerCompactCatalog(
					server,
					compactConfig({ ctx: embeddedCtx, externalWallet: true }),
				),
			"peer-compact-external",
		);
		expect(tools.map((tool) => tool.name)).not.toContain("wallet_payments");
	});

	test("does not register for ctx-derived external signer mode", async () => {
		const tools = await listTools(
			(server) =>
				registerCompactCatalog(
					server,
					compactConfig({ ctx: derivedExternalCtx }),
				),
			"peer-compact-derived-external",
		);
		expect(tools.map((tool) => tool.name)).not.toContain("wallet_payments");
	});

	test("does not register in project payments-only scope", async () => {
		const tools = await listTools(
			(server) =>
				registerCompactCatalog(
					server,
					compactConfig({ ctx: embeddedCtx, walletScope: "payments" }),
				),
			"peer-compact-payments-scope",
		);
		expect(tools.map((tool) => tool.name)).not.toContain("wallet_payments");
	});

	test("does not register in Droplit mode", async () => {
		const tools = await listTools(
			(server) =>
				registerCompactCatalog(
					server,
					compactConfig({ ctx: embeddedCtx, integratedWallet: droplitWallet }),
				),
			"peer-compact-droplit",
		);
		expect(tools.map((tool) => tool.name)).not.toContain("wallet_payments");
	});

	test("does not register without a BRC-100 ctx", async () => {
		const tools = await listTools(
			(server) =>
				registerCompactCatalog(server, compactConfig({ wallet: fakeWallet })),
			"peer-compact-walletless",
		);
		expect(tools.map((tool) => tool.name)).not.toContain("wallet_payments");
	});

	test("does not register when wallet tools are disabled", async () => {
		const tools = await listTools(
			(server) =>
				registerCompactCatalog(
					server,
					compactConfig({ ctx: embeddedCtx, enableWalletTools: false }),
				),
			"peer-compact-disabled",
		);
		expect(tools.map((tool) => tool.name)).not.toContain("wallet_payments");
	});

	test("capability metadata tracks the payments operation", () => {
		const embedded = getCompactCapabilityMetadata(
			compactConfig({ ctx: embeddedCtx }),
		).find((capability) => capability.operation === "wallet_peerPayments");
		if (!embedded) throw new Error("Expected wallet_peerPayments capability");
		expect(embedded.family).toBe("wallet_payments");
		expect(embedded.registered).toBe(true);

		const external = getCompactCapabilityMetadata(
			compactConfig({ ctx: embeddedCtx, externalWallet: true }),
		).find((capability) => capability.operation === "wallet_peerPayments");
		if (!external) throw new Error("Expected wallet_peerPayments capability");
		expect(external.registered).toBe(false);
	});
});
