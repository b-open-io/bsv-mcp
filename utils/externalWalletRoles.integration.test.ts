import { expect, test } from "bun:test";
import { PrivateKey, ProtoWallet } from "@bsv/sdk";
import { Client } from "@modelcontextprotocol/client";
import {
	type CallToolResult,
	InMemoryTransport,
	McpServer,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { registerWalletTools } from "../tools/wallet/tools";
import { readExternalWalletConfig } from "./externalWalletConfig";
import { createExternalWalletRuntime } from "./externalWalletRuntime";
import { McpApprovalFlow } from "./mcpApprovalFlow";
import { withMcpToolExecution } from "./mcpToolExecution";
import { readProjectWalletConfig } from "./projectWalletRuntime";
import { initExternalWallet } from "./walletInit";

function result<T>(value: CallToolResult): T {
	if (value.isError || value.content[0]?.type !== "text")
		throw new Error(JSON.stringify(value));
	return JSON.parse(value.content[0].text) as T;
}

test("external project roles perform real BRC-100 crypto over signer HTTP and modern MCP", async () => {
	const keys = {
		payments: PrivateKey.fromHex("11"),
		identity: PrivateKey.fromHex("12"),
		ordinals: PrivateKey.fromHex("13"),
		encryption: PrivateKey.fromHex("14"),
	};
	const calls: { role: string; method: string; origin: string | null }[] = [];
	const signer = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		async fetch(request) {
			const [role, method] = new URL(request.url).pathname.slice(1).split("/");
			const key = keys[role as keyof typeof keys];
			if (
				!key ||
				![
					"getPublicKey",
					"createSignature",
					"verifySignature",
					"encrypt",
					"decrypt",
					"createHmac",
					"verifyHmac",
				].includes(method ?? "")
			)
				return new Response(null, { status: 404 });
			calls.push({
				role: role!,
				method: method!,
				origin: request.headers.get("origin"),
			});
			const wallet = new ProtoWallet(key);
			const operation = Reflect.get(wallet, method!) as (
				args: unknown,
			) => Promise<unknown>;
			return Response.json(await operation.call(wallet, await request.json()));
		},
	});
	const base = `http://127.0.0.1:${signer.port}`;
	const env = {
		BSV_MCP_PROJECT_ROOT: "/synthetic/external-a",
		BSV_MCP_PROJECT_ID: "external-a",
		TRANSPORT: "stdio",
		BRC100_WALLET_URL: `${base}/payments`,
		BRC100_WALLET_ROLES: JSON.stringify(
			Object.fromEntries(
				Object.entries(keys).map(([role, key]) => [
					role,
					{
						url: `${base}/${role}`,
						expectedPublicKey: key.toPublicKey().toString(),
					},
				]),
			),
		),
	};
	const config = readExternalWalletConfig(env)!;
	expect(readProjectWalletConfig(env, [])).toBeUndefined();
	expect(
		readExternalWalletConfig({ ...env, BSV_MCP_PROJECT_ID: "external-b" })
			?.originator,
	).not.toBe(config.originator);
	const runtime = await createExternalWalletRuntime(config, "test");
	const flow = new McpApprovalFlow();
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const handle = serveStdio(
		(context) => {
			const server = withMcpToolExecution(
				new McpServer({ name: "external-roles", version: "1" }),
				context.era,
				flow,
			);
			registerWalletTools(server, undefined, {
				ctx: runtime.ctx,
				roleContexts: runtime.roleContexts,
				allowWholeWalletBalance: false,
			});
			return server;
		},
		{ transport: serverTransport, legacy: "reject" },
	);
	const client = new Client(
		{ name: "modern-external-client", version: "1" },
		{ versionNegotiation: { mode: "auto" } },
	);
	try {
		await client.connect(clientTransport);
		for (const [role, key] of Object.entries(keys)) {
			expect(
				result<{ publicKey: string }>(
					await client.callTool({
						name: "wallet_getPublicKey",
						arguments: { identityKey: true, walletRole: role },
					}),
				).publicKey,
			).toBe(key.toPublicKey().toString());
		}
		const signed = result<{ signature: number[] }>(
			await client.callTool({
				name: "wallet_createSignature",
				arguments: {
					data: [1, 2, 3],
					protocolIDJSON: '[2,"external identity"]',
					keyID: "project-message",
					counterparty: "self",
				},
			}),
		);
		expect(
			(
				await new ProtoWallet(keys.identity).verifySignature({
					data: [1, 2, 3],
					protocolID: [2, "external identity"],
					keyID: "project-message",
					counterparty: "self",
					signature: signed.signature,
				})
			).valid,
		).toBe(true);
		const encrypted = result<{ ciphertext: number[] }>(
			await client.callTool({
				name: "wallet_encrypt",
				arguments: {
					plaintext: [4, 5, 6],
					protocolIDJSON: '[2,"external encryption"]',
					keyID: "project-secret",
					counterparty: "self",
				},
			}),
		);
		expect(
			(
				await new ProtoWallet(keys.encryption).decrypt({
					ciphertext: encrypted.ciphertext,
					protocolID: [2, "external encryption"],
					keyID: "project-secret",
					counterparty: "self",
				})
			).plaintext,
		).toEqual([4, 5, 6]);
		expect(
			calls.every((call) => call.origin === `http://${config.originator}`),
		).toBe(true);
		expect(calls.find((call) => call.method === "createSignature")?.role).toBe(
			"identity",
		);
		expect(calls.find((call) => call.method === "encrypt")?.role).toBe(
			"encryption",
		);
		await expect(
			initExternalWallet(
				{
					url: `${base}/payments`,
					originator: config.originator,
					expectedPublicKey: keys.identity.toPublicKey().toString(),
				},
				"test",
			),
		).rejects.toThrow("readiness failed");
	} finally {
		await client.close();
		await handle.close();
		flow.close();
		await runtime.destroy();
		await signer.stop(true);
	}
});

test("external role configuration rejects malformed, empty and mixed custody selections", () => {
	const base = { BRC100_WALLET_URL: "http://127.0.0.1:3321" };
	for (const roles of [
		{},
		{ unknown: { url: base.BRC100_WALLET_URL } },
		{ payments: { url: "http://remote.example" } },
		{ identity: { url: base.BRC100_WALLET_URL, expectedPublicKey: "bad" } },
	]) {
		expect(() =>
			readExternalWalletConfig({
				...base,
				BRC100_WALLET_ROLES: JSON.stringify(roles),
			}),
		).toThrow();
	}
	expect(() =>
		readExternalWalletConfig({ ...base, BSV_MCP_PROJECT_ID: "missing-root" }),
	).toThrow();
	expect(() =>
		readProjectWalletConfig(
			{
				...base,
				BSV_MCP_PROJECT_ID: "project",
				BSV_MCP_PROJECT_ROOT: "/tmp/project",
				TRANSPORT: "stdio",
				BSV_MCP_PASSWORD: "unexpected",
			},
			[],
		),
	).toThrow("conflicts");
});
