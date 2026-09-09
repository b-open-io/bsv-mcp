import { afterEach, expect, test } from "bun:test";
import { BAP_PROTOCOL_ID, createContext } from "@1sat/actions";
import { AIP, BitCom } from "@1sat/templates";
import {
	KeyDeriver,
	P2PKH,
	PrivateKey,
	ProtoWallet,
	Script,
	Transaction,
	Utils,
	type WalletInterface,
} from "@bsv/sdk";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { buildAndSendTransaction } from "../utils/transactionBuilder";
import type { Wallet } from "../wallet/wallet";
import { registerBsocialTools } from "./index";
import { publishSocial, socialPublishSchema } from "./publish";
import { readSocial, socialReadSchema } from "./read";
import { socialActionSchema, socialOutputs } from "./schema";

const txid = "a".repeat(64);
const key = PrivateKey.fromHex("21");
const originalFetch = globalThis.fetch;
const originalDisabled = process.env.DISABLE_BROADCASTING;
afterEach(() => {
	globalThis.fetch = originalFetch;
	if (originalDisabled === undefined) delete process.env.DISABLE_BROADCASTING;
	else process.env.DISABLE_BROADCASTING = originalDisabled;
});
const fields = (script: Script) =>
	script.chunks.slice(2).map((chunk) => Utils.toUTF8(chunk.data ?? []));
const actions = [
	{
		type: "post",
		content: "# Hello",
		contentType: "text/markdown",
		app: "test-app",
		replyTo: txid,
		tags: ["bitcoin"],
		attachments: [
			{
				content: "AAEC",
				encoding: "base64",
				contentType: "image/png",
				filename: "tiny.png",
			},
		],
	},
	{
		type: "repost",
		txid,
		context: { key: "url", value: "https://example.com" },
	},
	{ type: "like", txid, emoji: "👍" },
	{ type: "unlike", txid },
	{ type: "follow", bapId: "friend123" },
	{ type: "unfollow", bapId: "friend123" },
	{
		type: "friend",
		bapId: "friend123",
		publicKey: key.toPublicKey().toString(),
	},
	{ type: "unfriend", bapId: "friend123" },
	{
		type: "message",
		content: "hello",
		context: { key: "channel", value: "test" },
	},
	{
		type: "video",
		provider: "youtube",
		videoID: "test-video",
		channel: "test",
		start: 0,
		duration: 12,
	},
] as const;

test("social schema encodes canonical targets, context, media, tags and attachments", () => {
	const encoded = actions.map((action) =>
		socialOutputs(socialActionSchema.parse(action)),
	);
	const post = fields(encoded[0].scripts[0]);
	expect(post.slice(2, 5)).toEqual(["text/markdown", "utf-8", ""]);
	expect(post).toContain("test-app");
	expect(post.slice(-4)).toEqual(["context", "tx", "tx", txid]);
	expect(fields(encoded[0].scripts[1]).slice(1)).toEqual([
		"ADD",
		"tags",
		"bitcoin",
	]);
	expect(encoded[0].scripts[2].chunks[3].data).toEqual([0, 1, 2]);
	expect(fields(encoded[1].scripts[0]).slice(-6)).toEqual([
		"tx",
		txid,
		"context",
		"url",
		"url",
		"https://example.com",
	]);
	for (const index of [4, 5, 6, 7])
		expect(fields(encoded[index].scripts[0])).toContain("bapID");
	expect(fields(encoded[8].scripts[0]).slice(-4)).toEqual([
		"context",
		"channel",
		"channel",
		"test",
	]);
	expect(fields(encoded[9].scripts[0])).toContain("videoID");
	for (const entry of encoded)
		for (const script of entry.scripts)
			expect(script.toHex().startsWith("006a")).toBe(true);
});

test("all actions and supplemental outputs use the current BAP signing key and one wallet transaction", async () => {
	delete process.env.DISABLE_BROADCASTING;
	const wallet = new ProtoWallet(key) as unknown as WalletInterface;
	wallet.listOutputs = async () => ({
		totalOutputs: 1,
		outputs: [
			{
				outpoint: `${txid}.0`,
				satoshis: 0,
				lockingScript: "006a",
				spendable: true,
				tags: ["type:id", "seq:2"],
			},
		],
	});
	const transactions: NonNullable<
		Parameters<WalletInterface["createAction"]>[0]["outputs"]
	>[] = [];
	wallet.createAction = async (input) => {
		transactions.push(input.outputs ?? []);
		return { txid };
	};
	const identityContext = createContext(wallet, { chain: "test" });
	for (const action of actions) {
		const result = await publishSocial(
			{ action: socialActionSchema.parse(action) },
			{ identityContext },
		);
		expect(result.txid).toBe(txid);
	}
	expect(transactions).toHaveLength(actions.length);
	expect(transactions[0]).toHaveLength(3);
	const expectedAddress = new KeyDeriver(key)
		.derivePrivateKey(BAP_PROTOCOL_ID, "identity-2", "self")
		.toAddress();
	for (const outputs of transactions)
		for (const output of outputs) {
			const decoded = BitCom.decode(Script.fromHex(output.lockingScript));
			if (!decoded) throw new Error("Missing Bitcom record");
			const aip = AIP.decode(decoded)[0];
			expect(aip?.verify()).toBe(true);
			expect(aip?.data.address).toBe(expectedAddress);
		}
});

test("disabled publishing, missing identity and invalid inputs cannot reach signing or funding; preview needs neither", async () => {
	let calls = 0;
	const wallet = new Proxy(
		{},
		{
			get: () => () => {
				calls++;
				throw new Error("wallet touched");
			},
		},
	) as Wallet;
	const action = { type: "post", content: "test" } as const;
	await expect(
		publishSocial({ action }, { wallet, disableBroadcasting: true }),
	).rejects.toThrow("DISABLE_BROADCASTING");
	expect(calls).toBe(0);
	const preview = await publishSocial(
		{ action, preview: true },
		{ wallet, disableBroadcasting: true },
	);
	expect(preview.preview).toBe(true);
	expect(calls).toBe(0);
	delete process.env.DISABLE_BROADCASTING;
	const noIdentity = {
		getIdentityKey: () => undefined,
		getPaymentKey: () => {
			calls++;
			return key;
		},
	} as unknown as Wallet;
	await expect(
		publishSocial({ action }, { wallet: noIdentity }),
	).rejects.toThrow("identity");
	expect(calls).toBe(0);
	const invalid = [
		{
			type: "repost",
			txid,
			context: { key: "channel", value: "x" },
			subcontext: { key: "tx", value: "b".repeat(64) },
		},
		{ type: "like", txid: "invalid" },
		{ type: "friend", bapId: "x" },
		{
			type: "post",
			content: "x",
			replyTo: txid,
			context: { key: "url", value: "x" },
		},
		{
			type: "message",
			content: "x",
			subcontext: { key: "channel", value: "x" },
		},
		{ type: "post", content: "x", context: { key: "app", value: "spoof" } },
		{ type: "follow", bapId: "x", additionalMapData: '{"type":"post"}' },
	];
	for (const value of invalid)
		expect(socialPublishSchema.safeParse({ action: value }).success).toBe(
			false,
		);
	await expect(
		publishSocial(
			{
				action: { ...action, encoding: "base64", content: "!!" },
				preview: true,
			},
			{},
		),
	).rejects.toThrow("base64");
	await expect(
		publishSocial(
			{ action: { ...action, content: "界".repeat(110_000) }, preview: true },
			{},
		),
	).rejects.toThrow("300 KB");
});

test("reads use implemented /social routes and preserve successful payloads", async () => {
	const urls: URL[] = [];
	globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
		urls.push(new URL(String(input)));
		return Response.json({ results: [], signers: [] });
	}) as unknown as typeof fetch;
	const cases = [
		[{ type: "posts" }, "/social/feed"],
		[{ type: "posts", bapId: "author" }, "/social/post/bap/author"],
		[{ type: "posts", bapId: "author", feed: true }, "/social/feed/author"],
		[{ type: "post", txid }, `/social/post/${txid}`],
		[{ type: "replies", txid }, `/social/post/${txid}/reply`],
		[{ type: "search", q: "hello" }, "/social/post/search"],
		[{ type: "likes", txid }, `/social/post/${txid}/like`],
		[{ type: "likes", bapId: "author" }, "/social/bap/author/like"],
		[{ type: "friends", bapId: "author" }, "/social/friend/author"],
		[{ type: "channels" }, "/social/channels"],
		[
			{ type: "messages", channel: "test/#room" },
			"/social/channels/test%2F%23room/messages",
		],
		[
			{ type: "messages", bapId: "author", targetBapId: "friend" },
			"/social/@/author/messages/friend",
		],
		[{ type: "videos", channel: "test" }, "/social/video"],
	] as const;
	for (const [query, expected] of cases) {
		const value = await readSocial({ query });
		expect(urls.at(-1)?.pathname).toBe(expected);
		expect(value.data).toEqual({ results: [], signers: [] });
	}
	expect(urls[5].searchParams.get("q")).toBe("hello");
	expect(urls.at(-1)?.searchParams.get("channel")).toBe("test");
	for (const query of [
		{ type: "likes" },
		{ type: "posts", feed: true },
		{ type: "messages", channel: "a", bapId: "b" },
		{ type: "records", types: ["$out"] },
		{ type: "posts", limit: 1.5 },
	])
		expect(socialReadSchema.safeParse({ query }).success).toBe(false);
});

test("action history uses bounded fixed query stages and keeps undo records", async () => {
	let url = "";
	globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
		url = String(input);
		return Response.json({ follow: [], signers: [] });
	}) as unknown as typeof fetch;
	const result = await readSocial({
		query: {
			type: "records",
			types: ["follow", "unfollow"],
			targetBapId: "target",
			limit: 5,
			page: 2,
		},
	});
	const encoded = new URL(url).pathname.split("/").at(-1) ?? "";
	const query = JSON.parse(
		Buffer.from(decodeURIComponent(encoded), "base64").toString(),
	);
	expect(query.q.aggregate).toEqual([
		{ $match: { "MAP.bapID": "target" } },
		{ $sort: { timestamp: -1 } },
		{ $limit: 10 },
		{ $project: { in: 0, out: 0 } },
		{
			$unionWith: {
				coll: "unfollow",
				pipeline: [
					{ $match: { "MAP.bapID": "target" } },
					{ $sort: { timestamp: -1 } },
					{ $limit: 10 },
					{ $project: { in: 0, out: 0 } },
				],
			},
		},
		{ $sort: { timestamp: -1 } },
		{ $skip: 5 },
		{ $limit: 5 },
		{ $project: { in: 0, out: 0 } },
	]);
	expect(result.interpretation).toContain("not current relationship state");
});

test("upstream failures remain errors, and the consolidated tools work over MCP", async () => {
	const server = new McpServer({ name: "social-test", version: "1" });
	registerBsocialTools(server, {
		wallet: {} as Wallet,
		disableBroadcasting: true,
	});
	const client = new Client({ name: "social-test-client", version: "1" });
	const [a, b] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(b), client.connect(a)]);
	try {
		expect(
			(await client.listTools()).tools.map((tool) => tool.name).sort(),
		).toEqual(["bsocial_publish", "bsocial_read"]);
		const preview = await client.callTool({
			name: "bsocial_publish",
			arguments: { action: { type: "post", content: "test" }, preview: true },
		});
		expect(preview.isError).not.toBe(true);
		for (const response of [
			Response.json({ error: "bad query" }),
			new Response("missing", { status: 404 }),
			new Response("invalid json"),
			new Response("x".repeat(4 * 1024 * 1024 + 1)),
		]) {
			globalThis.fetch = (async () => response) as unknown as typeof fetch;
			const result = await client.callTool({
				name: "bsocial_read",
				arguments: { query: { type: "posts" } },
			});
			expect(result.isError).toBe(true);
		}
	} finally {
		await client.close();
		await server.close();
	}
});

test("legacy publishing signs with the identity key and funds with the payment key", async () => {
	delete process.env.DISABLE_BROADCASTING;
	const paymentKey = PrivateKey.fromHex("22");
	const fundingScript = new P2PKH().lock(paymentKey.toAddress());
	const wallet = {
		getIdentityKey: () => key,
		getPaymentKey: () => paymentKey,
		getUtxos: async () => ({
			paymentUtxos: [
				{ txid, vout: 0, satoshis: 10000, script: fundingScript.toHex() },
			],
			nftUtxos: [],
		}),
	} as unknown as Wallet;
	let submitted: Transaction | undefined;
	globalThis.fetch = (async (
		_input: Parameters<typeof fetch>[0],
		init?: RequestInit,
	) => {
		submitted = Transaction.fromBinary(
			Array.from(new Uint8Array(init?.body as ArrayBuffer)),
		);
		return Response.json({ success: true });
	}) as unknown as typeof fetch;
	await publishSocial(
		{ action: { type: "follow", bapId: "friend123" } },
		{ wallet },
	);
	expect(submitted).toBeDefined();
	const script = submitted?.outputs[0].lockingScript;
	if (!script) throw new Error("Missing social output");
	const decoded = BitCom.decode(script);
	if (!decoded) throw new Error("Missing Bitcom record");
	const aip = AIP.decode(decoded)[0];
	expect(aip?.verify()).toBe(true);
	expect(aip?.data.address).toBe(key.toAddress());
	expect(aip?.data.address).not.toBe(paymentKey.toAddress());
	expect(submitted?.outputs.at(-1)?.lockingScript.toHex()).toBe(
		fundingScript.toHex(),
	);
});

test("legacy funding reports insufficient funds and broadcast rejection", async () => {
	delete process.env.DISABLE_BROADCASTING;
	const script = new P2PKH().lock(key.toAddress());
	const config = {
		outputs: [{ script, satoshis: 900 }],
		utxos: [{ txid, vout: 0, satoshis: 1000, script: script.toHex() }],
		changeAddress: key.toAddress(),
		paymentKey: key,
	};
	const insufficient = await buildAndSendTransaction(
		{ ...config, outputs: [{ script, satoshis: 1000 }] },
		false,
	);
	expect(insufficient.success).toBe(false);
	expect(insufficient.error).toContain("Insufficient funds");
	const built = await buildAndSendTransaction(config, false);
	expect(built.success).toBe(true);
	expect(built.fee).toBe(100);
	if (!built.rawTx) throw new Error("Missing funded transaction");
	expect(built.fee).toBeGreaterThanOrEqual(
		Math.ceil((built.rawTx.length / 2) * 0.05),
	);
	globalThis.fetch = (async () =>
		Response.json(
			{ error: "rejected" },
			{ status: 400 },
		)) as unknown as typeof fetch;
	const rejected = await buildAndSendTransaction(config);
	expect(rejected.success).toBe(false);
	expect(rejected.error).toContain("broadcast failed");
});
