import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	type BuiltMcpExecutable,
	buildMcpExecutable,
	createWalletModeFixture,
	jsonFromResult,
	type RunningMcpWalletMode,
	runWalletMode,
	textFromResult,
	type WalletModeFixture,
} from "./helpers/mcp-wallet-modes.ts";

type Balance = {
	satoshis: number;
	bsv: number;
	utxoCount: number;
};

type Address = {
	address: string;
	status: string;
};

let executable: BuiltMcpExecutable;

beforeAll(() => {
	executable = buildMcpExecutable();
});

afterAll(() => {
	executable?.cleanup();
});

async function startMode(mode: "external" | "embedded"): Promise<{
	fixture: WalletModeFixture;
	running: RunningMcpWalletMode;
}> {
	const fixture = await createWalletModeFixture(mode);
	try {
		const running = await runWalletMode(executable.path, fixture);
		return { fixture, running };
	} catch (error) {
		await fixture.cleanup();
		throw error;
	}
}

describe("built MCP wallet modes", () => {
	it("scopes external signer capabilities away from whole-wallet balance", async () => {
		const external = await startMode("external");
		try {
			const externalTools = await external.running.client.listTools();
			const externalNames = externalTools.tools.map((tool) => tool.name);

			expect(externalNames).toContain("wallet_getAddress");
			expect(externalNames).not.toContain("wallet_getBalance");
			expect(externalNames).not.toContain("wallet_list");
			expect(externalNames).not.toContain("app_wallet_data");
			const externalAddressResult = await external.running.client.callTool({
				name: "wallet_getAddress",
				arguments: {},
			});
			expect(externalAddressResult.isError).not.toBe(true);
			expect(jsonFromResult<Address>(externalAddressResult).status).toBe("ok");
		} finally {
			await external.running.close();
			await external.fixture.cleanup();
		}
	});

	it("keeps balance, address, and account capabilities in embedded mode", async () => {
		const embedded = await startMode("embedded");
		try {
			const tools = await embedded.running.client.listTools();
			const names = tools.tools.map((tool) => tool.name);
			for (const name of [
				"wallet_getBalance",
				"wallet_getAddress",
				"wallet_list",
				"app_wallet_data",
			])
				expect(names).toContain(name);

			const balanceResult = await embedded.running.client.callTool({
				name: "wallet_getBalance",
				arguments: {},
			});
			expect(balanceResult.isError).not.toBe(true);
			expect(jsonFromResult<Balance>(balanceResult)).toMatchObject({
				satoshis: 0,
				bsv: 0,
				utxoCount: 0,
			});
			const addressResult = await embedded.running.client.callTool({
				name: "wallet_getAddress",
				arguments: {},
			});
			expect(addressResult.isError).not.toBe(true);
			expect(jsonFromResult<Address>(addressResult).status).toBe("ok");
		} finally {
			await embedded.running.close();
			await embedded.fixture.cleanup();
		}
	});

	it("does not bleed local account state into the external signer mode", async () => {
		const [external, embedded] = await Promise.all([
			startMode("external"),
			startMode("embedded"),
		]);
		try {
			expect(external.fixture.stubSigner).toBeDefined();
			expect(embedded.fixture.stubSigner).toBeUndefined();
			expect(external.running.stderr()).toContain(
				"External BRC-100 signer ready",
			);
			expect(external.running.stderr()).not.toContain(
				"Custom Wallet initialized successfully",
			);
			expect(embedded.running.stderr()).toContain(
				"Custom Wallet initialized successfully",
			);
			expect(embedded.running.stderr()).not.toContain(
				"External BRC-100 signer ready",
			);

			const signerRequests = external.fixture.stubSigner?.requests ?? [];
			expect(signerRequests.map((request) => request.path)).toContain(
				"/getPublicKey",
			);
			expect(signerRequests.map((request) => request.path)).not.toContain(
				"/listOutputs",
			);
		} finally {
			await Promise.all([
				external.running.close(),
				embedded.running.close(),
				external.fixture.cleanup(),
				embedded.fixture.cleanup(),
			]);
		}
	});

	it("keeps the disposable embedded fixture encrypted and unfunded", async () => {
		const { fixture, running } = await startMode("embedded");
		try {
			const result = await running.client.callTool({
				name: "wallet_list",
				arguments: {},
			});
			expect(result.isError).not.toBe(true);
			const listed = JSON.parse(textFromResult(result)) as {
				accounts: Array<{ name: string; encrypted: boolean }>;
			};
			expect(listed.accounts).toContainEqual(
				expect.objectContaining({ name: "default", encrypted: true }),
			);
			expect(fixture.env.BSV_MCP_PASSWORD).toBe("synthetic-test-passphrase");
		} finally {
			await running.close();
			await fixture.cleanup();
		}
	});
});
