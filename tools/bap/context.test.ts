import { expect, test } from "bun:test";
import { BAP_PROTOCOL_ID, createContext } from "@1sat/actions";
import { AIP, BAP, BitCom } from "@1sat/templates";
import {
	KeyDeriver,
	PrivateKey,
	ProtoWallet,
	Script,
	type WalletInterface,
} from "@bsv/sdk";
import { Client } from "@modelcontextprotocol/client";
import {
	type CallToolResult,
	InMemoryTransport,
	McpServer,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { McpApprovalFlow } from "../../utils/mcpApprovalFlow";
import { withMcpToolExecution } from "../../utils/mcpToolExecution";
import { initExternalWallet } from "../../utils/walletInit";
import { registerSocialPublishTool } from "../bsocial/publish";
import { registerContextBapTools } from "./context";

function result(value: CallToolResult): Record<string, unknown> {
	if (value.isError || value.content[0]?.type !== "text")
		throw new Error(JSON.stringify(value));
	return JSON.parse(value.content[0].text);
}

for (const mode of ["embedded", "external"] as const)
	test(`modern BAP ${mode} derives and verifies publication, rotation, attestation and profile signatures`, async () => {
		const key = PrivateKey.fromHex("21");
		const wallet = new ProtoWallet(key) as unknown as WalletInterface;
		const records: (NonNullable<
			Parameters<WalletInterface["createAction"]>[0]["outputs"]
		>[number] & { outpoint: string; spendable: boolean })[] = [];
		const transactions: NonNullable<
			Parameters<WalletInterface["createAction"]>[0]["outputs"]
		>[] = [];
		wallet.listOutputs = async (input) => {
			const outputs = records.filter(
				(output) =>
					output.basket === input.basket &&
					(!input.tags?.length ||
						input.tags.every((tag) => output.tags?.includes(tag))),
			);
			return {
				totalOutputs: outputs.length,
				outputs: outputs.slice(
					input.offset ?? 0,
					(input.offset ?? 0) + (input.limit ?? 100),
				),
			};
		};
		wallet.createAction = async (input) => {
			const outputs = input.outputs ?? [];
			transactions.push(outputs);
			const txid = transactions.length.toString(16).padStart(64, "0");
			for (const [index, output] of outputs.entries())
				records.push({
					...output,
					outpoint: `${txid}.${index}`,
					spendable: true,
				});
			return { txid };
		};
		wallet.relinquishOutput = async (input) => {
			const index = records.findIndex(
				(output) =>
					output.outpoint === input.output && output.basket === input.basket,
			);
			if (index >= 0) records.splice(index, 1);
			return { relinquished: true };
		};
		const signer =
			mode === "external"
				? Bun.serve({
						hostname: "127.0.0.1",
						port: 0,
						async fetch(request) {
							const method = new URL(request.url).pathname.slice(1);
							if (
								![
									"getPublicKey",
									"createSignature",
									"listOutputs",
									"createAction",
									"relinquishOutput",
								].includes(method)
							)
								return new Response(null, { status: 404 });
							try {
								return Response.json(
									await Reflect.apply(Reflect.get(wallet, method), wallet, [
										await request.json(),
									]),
								);
							} catch (error) {
								return Response.json(
									{ message: String(error) },
									{ status: 500 },
								);
							}
						},
					})
				: undefined;
		const external = signer
			? await initExternalWallet(
					{
						url: `http://127.0.0.1:${signer.port}`,
						originator: "bap-project.example",
						expectedPublicKey: key.toPublicKey().toString(),
					},
					"test",
				)
			: undefined;
		const ctx = external?.ctx ?? createContext(wallet, { chain: "test" });
		const flow = new McpApprovalFlow();
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		const handle = serveStdio(
			(context) => {
				const server = withMcpToolExecution(
					new McpServer({ name: "bap-modern", version: "1" }),
					context.era,
					flow,
				);
				registerContextBapTools(server, ctx);
				registerSocialPublishTool(server, { identityContext: ctx });
				return server;
			},
			{ transport: serverTransport, legacy: "reject" },
		);
		const client = new Client(
			{ name: "bap-client", version: "1" },
			{ versionNegotiation: { mode: "auto" } },
		);
		const call = async (name: string, args: Record<string, unknown> = {}) =>
			result(await client.callTool({ name, arguments: args }));
		try {
			await client.connect(clientTransport);
			const before = await call("bap_getIdentity");
			expect(before.published).toBe(false);
			const published = await call("bap_publishIdentity");
			expect(published.bapId).toBe(before.bapId);
			expect((await call("bap_getIdentity")).published).toBe(true);
			expect(
				(await client.callTool({ name: "bap_publishIdentity", arguments: {} }))
					.isError,
			).toBe(true);
			expect(transactions).toHaveLength(1);
			await call("bap_rotateIdentity");
			await call("bap_attest", {
				attestationHash: "a".repeat(64),
				counter: "1",
			});
			await call("bap_updateProfile", {
				profile: { "@type": "Person", name: "Synthetic identity" },
			});
			expect((await call("bap_getProfile")).profile).toEqual({
				"@type": "Person",
				name: "Synthetic identity",
			});
			await call("bsocial_publish", {
				action: {
					type: "post",
					content: "Synthetic public post",
					tags: ["test"],
				},
			});
			expect(transactions).toHaveLength(5);
			for (const [index, outputs] of transactions.entries()) {
				const bitcom = BitCom.decode(Script.fromHex(outputs[0]?.lockingScript));
				if (!bitcom) throw new Error("Missing BAP output");
				const aip = AIP.decode(bitcom)[0];
				expect(aip?.verify()).toBe(true);
				const signingIndex = index === 0 ? 0 : index === 1 ? 1 : 2;
				const expected = new KeyDeriver(key)
					.derivePrivateKey(BAP_PROTOCOL_ID, `identity-${signingIndex}`, "self")
					.toAddress();
				expect(aip?.data.address).toBe(expected);
				if (index < 2)
					expect(BAP.decode(bitcom)?.idKey).toBe(String(before.bapId));
			}
			expect(
				records.filter((output) => output.tags?.includes("type:id")),
			).toHaveLength(1);
		} finally {
			await client.close();
			await handle.close();
			flow.close();
			await external?.destroy();
			await signer?.stop(true);
		}
	});

test("BAP broadcast policy refuses before any provider call", async () => {
	const server = new McpServer({ name: "bap-disabled", version: "1" });
	const wallet = new Proxy({} as WalletInterface, {
		get() {
			throw new Error("Provider must not be accessed");
		},
	});
	registerContextBapTools(server, createContext(wallet), true);
	const client = new Client({ name: "test", version: "1" });
	const [a, b] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(b), client.connect(a)]);
	try {
		const response = await client.callTool({
			name: "bap_publishIdentity",
			arguments: {},
		});
		expect(response.isError).toBe(true);
		expect(JSON.stringify(response.content)).toContain("DISABLE_BROADCASTING");
	} finally {
		await client.close();
		await server.close();
	}
});
