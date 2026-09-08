import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { createContext } from "@1sat/actions";
import * as nodeWallet from "@1sat/wallet-node";
import { PrivateKey, type WalletInterface } from "@bsv/sdk";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { registerAllTools } from "../tools";
import {
	initializeKeysForWalletMode,
	readExternalWalletConfig,
} from "./externalWalletConfig";
import { SecureKeyManager } from "./keyManager";
import { destroyWallet, initExternalWallet } from "./walletInit";

const identityKey =
	"0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const config = { url: "http://127.0.0.1:3321", originator: "bsv-mcp.local" };
afterEach(() => mock.restore());

describe("external wallet configuration", () => {
	it("allows an explicit sponsor alongside the signer", () => {
		expect(
			readExternalWalletConfig({
				BRC100_WALLET_URL: config.url,
				DROPLIT_API_URL: "https://api.droplit.dev/droplit",
				DROPLIT_FAUCET_NAME: "sponsor",
			}),
		).toEqual(config);
	});
	it("preserves local selection and bypasses key loading only in explicit external mode", async () => {
		const loader = mock(async () => ({ source: "local" }));
		expect(readExternalWalletConfig({})).toBeUndefined();
		expect(await initializeKeysForWalletMode(undefined, loader)).toEqual({
			source: "local",
		});
		expect(await initializeKeysForWalletMode(config, loader)).toBeUndefined();
		expect(loader).toHaveBeenCalledTimes(1);
		expect(readExternalWalletConfig({ BRC100_WALLET_URL: config.url })).toEqual(
			config,
		);
	});
	for (const url of [
		"",
		"garbage",
		"http://signer.example",
		"ftp://localhost",
		"https://user:pass@signer.example",
		"https://signer.example/#fragment",
		"http://127.0.0.1/?q=1",
	]) {
		it(`rejects signer URL ${url}`, () => {
			expect(() =>
				readExternalWalletConfig({ BRC100_WALLET_URL: url }),
			).toThrow();
		});
	}
	for (const originator of [
		"",
		" ",
		"admin.bsv-mcp.internal",
		"https://ADMIN.bsv-mcp.internal",
		"https://user@wallet.example",
		"https://wallet.example/path",
		"https://wallet.example/?x=1",
		"https://wallet.example/#",
		"file:///tmp/wallet",
		"wallet example",
	]) {
		it(`rejects originator ${originator}`, () => {
			expect(() =>
				readExternalWalletConfig({
					BRC100_WALLET_URL: config.url,
					BRC100_WALLET_ORIGINATOR: originator,
				}),
			).toThrow();
		});
	}
	for (const conflict of [
		"PRIVATE_KEY_WIF",
		"IDENTITY_KEY_WIF",
		"USE_DROPLIT_API",
	]) {
		it(`rejects explicit ${conflict} conflict`, () => {
			expect(() =>
				readExternalWalletConfig({
					BRC100_WALLET_URL: config.url,
					[conflict]: "true",
				}),
			).toThrow("conflicts");
		});
	}
	it("accepts HTTPS and loopback, with a non-admin origin", () => {
		for (const url of [
			"https://signer.example/rpc",
			"http://localhost:3321",
			"http://127.0.0.2:3321",
			"http://[::1]:3321",
		]) {
			expect(
				readExternalWalletConfig({
					BRC100_WALLET_URL: url,
					BRC100_WALLET_ORIGINATOR: "https://agent.example",
				})?.originator,
			).toBe("https://agent.example");
		}
		expect(() =>
			readExternalWalletConfig({ BRC100_WALLET_ORIGINATOR: "agent.example" }),
		).toThrow("requires");
	});
});

async function connectTools(wallet: WalletInterface) {
	const server = new McpServer({ name: "external-test", version: "1.0.0" });
	registerAllTools(server, {
		ctx: createContext(wallet),
		enableBsvTools: false,
		enableOrdinalsTools: false,
		enableUtilsTools: false,
	});
	const client = new Client({ name: "wallet-test", version: "1.0.0" });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);
	return {
		client,
		close: async () => {
			await client.close();
			await server.close();
		},
	};
}

describe("context-only wallet tools", () => {
	for (const [method, payload] of [
		["encrypt", { plaintext: [1] }],
		["decrypt", { ciphertext: [1] }],
		["createHmac", { data: [1] }],
		["verifyHmac", { data: [1], hmac: [2] }],
		["createSignature", { data: [1] }],
		["verifySignature", { data: [1], signature: [2], forSelf: false }],
	] as const) {
		it(`preserves explicit permission and reason for ${method}`, async () => {
			const call = mock(async (_args: unknown) => ({}));
			const wallet = { [method]: call } as unknown as WalletInterface;
			const { client, close } = await connectTools(wallet);
			try {
				for (const seekPermission of [false, true]) {
					const args = {
						...payload,
						keyID: "test",
						counterparty: "self",
						privileged: true,
						privilegedReason: "Caller supplied reason",
						seekPermission,
					};
					const result = await client.callTool({
						name: `wallet_${method}`,
						arguments: { ...args, protocolIDJSON: '[2,"test protocol"]' },
					});
					expect(result.isError).not.toBe(true);
					expect(call).toHaveBeenLastCalledWith({
						...args,
						protocolID: [2, "test protocol"],
					});
				}
				call.mockImplementation(async () => {
					throw new Error("Signer declined permission");
				});
				const result = await client.callTool({
					name: `wallet_${method}`,
					arguments: {
						...payload,
						keyID: "test",
						protocolIDJSON: '[2,"test protocol"]',
						seekPermission: false,
						privilegedReason: "Keep this reason",
					},
				});
				expect(result.isError).toBe(true);
				expect(JSON.stringify(result.content)).toContain(
					"Signer declined permission",
				);
				expect(call.mock.calls.at(-1)?.[0]).toMatchObject({
					seekPermission: false,
					privilegedReason: "Keep this reason",
				});
			} finally {
				await close();
			}
		});
	}
	for (const [method, args] of [
		[
			"internalizeAction",
			{ txJSON: "[1]", outputsJSON: "[]", description: "Test import" },
		],
		["listActions", { labelsJSON: "[]" }],
		["listOutputs", { basket: "default" }],
		["discoverByIdentityKey", { identityKey }],
		["discoverByAttributes", { attributesJSON: '{"name":"test"}' }],
	] as const) {
		it(`preserves permission choice for ${method}`, async () => {
			const call = mock(async (_args: unknown) => ({}));
			const { client, close } = await connectTools({
				[method]: call,
			} as unknown as WalletInterface);
			try {
				for (const seekPermission of [false, true]) {
					const result = await client.callTool({
						name: `wallet_${method}`,
						arguments: { ...args, seekPermission },
					});
					expect(result.isError).not.toBe(true);
					expect(call.mock.calls.at(-1)?.[0]).toMatchObject({ seekPermission });
				}
			} finally {
				await close();
			}
		});
	}
	it("forwards wallet arguments and permission rejection through real MCP calls", async () => {
		const getPublicKey = mock(async () => ({ publicKey: identityKey }));
		const listOutputs = mock(async () => ({ totalOutputs: 0, outputs: [] }));
		const createSignature = mock(async () => ({ signature: [1, 2, 3] }));
		const wallet = {
			getPublicKey,
			listOutputs,
			createSignature,
		} as unknown as WalletInterface;
		const { client, close } = await connectTools(wallet);
		try {
			const catalog = (await client.listTools()).tools.map((tool) => tool.name);
			for (const name of [
				"wallet_getPublicKey",
				"wallet_listOutputs",
				"wallet_createSignature",
				"wallet_sendBsv",
				"wallet_getBalance",
				"wallet_createAction",
				"bap_getId",
			])
				expect(catalog).toContain(name);
			for (const name of [
				"wallet_mintCollection",
				"wallet_gatherCollectionInfo",
				"bap_generate",
				"mnee_sendMnee",
			])
				expect(catalog).not.toContain(name);
			const publicKeyArgs = {
				identityKey: true,
				seekPermission: true,
				privileged: true,
				privilegedReason: "test permission",
			};
			await client.callTool({
				name: "wallet_getPublicKey",
				arguments: publicKeyArgs,
			});
			expect(getPublicKey).toHaveBeenLastCalledWith({
				...publicKeyArgs,
				protocolID: undefined,
			});
			const outputArgs = {
				basket: "test",
				seekPermission: false,
				tagQueryMode: "all",
				include: "locking scripts",
				includeCustomInstructions: true,
				includeTags: true,
				includeLabels: false,
				limit: 3,
				offset: 2,
			};
			await client.callTool({
				name: "wallet_listOutputs",
				arguments: { ...outputArgs, tagsJSON: '["test-tag"]' },
			});
			expect(listOutputs).toHaveBeenLastCalledWith({
				...outputArgs,
				tags: ["test-tag"],
			});
			const signatureArgs = {
				data: [4, 5],
				keyID: "test",
				counterparty: "self",
				privileged: false,
				seekPermission: false,
				privilegedReason: "Caller supplied reason",
			};
			await client.callTool({
				name: "wallet_createSignature",
				arguments: { ...signatureArgs, protocolIDJSON: '[2,"test protocol"]' },
			});
			expect(createSignature).toHaveBeenLastCalledWith({
				...signatureArgs,
				protocolID: [2, "test protocol"],
			});
			getPublicKey.mockImplementation(async () => {
				throw new Error("Permission denied by signer");
			});
			const denied = await client.callTool({
				name: "wallet_getPublicKey",
				arguments: { identityKey: true, seekPermission: false },
			});
			expect(denied.isError).toBe(true);
			expect(JSON.stringify(denied.content)).toContain(
				"Permission denied by signer",
			);
			expect(getPublicKey).toHaveBeenLastCalledWith({
				identityKey: true,
				seekPermission: false,
				protocolID: undefined,
			});
		} finally {
			await close();
		}
	});
});

describe("external signer initialization", () => {
	it("rejects signer redirects without following them", async () => {
		let requests = 0;
		const signer = Bun.serve({
			hostname: "127.0.0.1",
			port: 0,
			fetch() {
				requests++;
				return new Response(null, {
					status: 302,
					headers: { Location: "/different-wallet" },
				});
			},
		});
		try {
			await expect(
				initExternalWallet({
					...config,
					url: `http://127.0.0.1:${signer.port}`,
				}),
			).rejects.toThrow("External BRC-100 signer readiness failed");
			expect(requests).toBe(1);
		} finally {
			await signer.stop(true);
		}
	});
	it("aborts an unresponsive handshake at the configured timeout without retry", async () => {
		const realTimeout = AbortSignal.timeout.bind(AbortSignal);
		const timeout = spyOn(AbortSignal, "timeout").mockImplementation(() =>
			realTimeout(10),
		);
		const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
			((_input, init) =>
				new Promise((_resolve, reject) => {
					const signal = init?.signal;
					if (!signal) throw new Error("Missing timeout signal");
					signal.addEventListener("abort", () => reject(signal.reason), {
						once: true,
					});
				})) as typeof fetch,
		);
		await expect(initExternalWallet(config)).rejects.toThrow(
			"External BRC-100 signer readiness failed",
		);
		expect(timeout).toHaveBeenCalledWith(10_000);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
	});
	it("uses the actual HTTPWalletJSON transport, headers and signer identity without startup writes", async () => {
		const requests: {
			path: string;
			origin: string | null;
			originator: string | null;
			args: unknown;
		}[] = [];
		const signer = Bun.serve({
			hostname: "127.0.0.1",
			port: 0,
			async fetch(req) {
				const path = new URL(req.url).pathname;
				requests.push({
					path,
					origin: req.headers.get("origin"),
					originator: req.headers.get("originator"),
					args: await req.json(),
				});
				if (path === "/getPublicKey")
					return Response.json({ publicKey: identityKey });
				if (path === "/listOutputs")
					return Response.json({ totalOutputs: 0, outputs: [] });
				if (path === "/createSignature")
					return Response.json({ signature: [1, 2] });
				return Response.json({ message: "unexpected call" }, { status: 500 });
			},
		});
		try {
			const result = await initExternalWallet({
				...config,
				url: `http://127.0.0.1:${signer.port}`,
			});
			expect(result.identityKey).toBe(identityKey);
			expect(result.ctx.wallet).toBe(result.wallet);
			expect(requests).toEqual([
				{
					path: "/getPublicKey",
					origin: "http://bsv-mcp.local",
					originator: "http://bsv-mcp.local",
					args: { identityKey: true },
				},
			]);
			await result.ctx.wallet.listOutputs({ basket: "default" });
			await result.ctx.wallet.createSignature({
				data: [1],
				protocolID: [2, "test protocol"],
				keyID: "test",
			});
			await destroyWallet();
			expect(requests.map((request) => request.path)).toEqual([
				"/getPublicKey",
				"/listOutputs",
				"/createSignature",
			]);
			// MCP teardown does not stop the externally owned signer.
			expect(
				(await result.wallet.getPublicKey({ identityKey: true })).publicKey,
			).toBe(identityKey);
		} finally {
			await signer.stop(true);
		}
	});
	it("failed readiness never loads/generates keys or provisions a node wallet, and does not retry", async () => {
		const generate = spyOn(PrivateKey, "fromRandom");
		const loadKeys = spyOn(SecureKeyManager.prototype, "loadKeys");
		const provision = spyOn(nodeWallet, "createNodeWallet");
		const fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(
			new Error("signer unavailable"),
		);
		const loader = mock(async () => {
			throw new Error("local keys must never load");
		});
		expect(await initializeKeysForWalletMode(config, loader)).toBeUndefined();
		await expect(initExternalWallet(config)).rejects.toThrow(
			"External BRC-100 signer readiness failed",
		);
		expect(loader).not.toHaveBeenCalled();
		expect(generate).not.toHaveBeenCalled();
		expect(loadKeys).not.toHaveBeenCalled();
		expect(provision).not.toHaveBeenCalled();
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const options = fetchSpy.mock.calls[0]?.[1];
		expect(options?.signal).toBeInstanceOf(AbortSignal);
		expect(options?.redirect).toBe("error");
	});
});
