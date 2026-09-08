import { afterEach, describe, expect, spyOn, test } from "bun:test";
import {
	createContext,
	inscribe,
	type OneSatContext,
	type WalletInterface,
} from "@1sat/actions";
import { KeyDeriver, PrivateKey, ProtoWallet } from "@bsv/sdk";
import type {
	CallToolResult,
	McpServer,
	ServerContext,
} from "@modelcontextprotocol/server";
import { BAP_IDENTITY_NOT_PUBLISHED } from "../../utils/sigmaSigningContext";
import {
	type CreateOrdinalsArgs,
	registerCreateOrdinalsTool,
} from "./createOrdinals";

type CreateOrdinalsHandler = (
	args: CreateOrdinalsArgs,
	extra: ServerContext,
) => Promise<CallToolResult>;

function captureHandler(
	ctx: OneSatContext | undefined,
	identity?: OneSatContext | null,
) {
	let handler: CreateOrdinalsHandler | undefined;
	const server = {
		registerTool(
			_name: string,
			_config: unknown,
			callback: CreateOrdinalsHandler,
		) {
			handler = callback;
		},
	} as unknown as McpServer;
	registerCreateOrdinalsTool(server, ctx, identity);
	return async (args: CreateOrdinalsArgs): Promise<CallToolResult> => {
		if (!handler)
			throw new Error("wallet_createOrdinals handler was not registered");
		return handler(args, {} as ServerContext);
	};
}

interface SyntheticWallet {
	ctx: OneSatContext;
	listOutputsCalls: () => number;
	getPublicKeyCalls: () => number;
	createActionCalls: () => number;
	createSignatureCalls: () => number;
}

function syntheticWallet(seqs: number[]): SyntheticWallet {
	const root = PrivateKey.fromRandom();
	const proto = new ProtoWallet(new KeyDeriver(root));
	const wallet = proto as unknown as WalletInterface;
	let listOutputsCalls = 0;
	let getPublicKeyCalls = 0;
	let createActionCalls = 0;
	let createSignatureCalls = 0;
	const innerGetPublicKey = proto.getPublicKey.bind(proto);
	wallet.getPublicKey = async (args) => {
		getPublicKeyCalls += 1;
		return innerGetPublicKey(args);
	};
	const innerCreateSignature = proto.createSignature.bind(proto);
	wallet.createSignature = async (args) => {
		createSignatureCalls += 1;
		return innerCreateSignature(args);
	};
	const innerCreateAction = wallet.createAction?.bind(wallet);
	wallet.createAction = (async (args: never) => {
		createActionCalls += 1;
		if (innerCreateAction) return innerCreateAction(args as never);
		throw new Error(
			"wallet.createAction should not run in Sigma preflight tests",
		);
	}) as WalletInterface["createAction"];
	wallet.listOutputs = async () => {
		listOutputsCalls += 1;
		return {
			totalOutputs: seqs.length,
			outputs: seqs.map((seq, index) => ({
				satoshis: 1,
				spendable: true,
				tags: ["type:id", `seq:${seq}`],
				outpoint: `${"11".repeat(32)}.${index}`,
			})),
		};
	};
	return {
		ctx: createContext(wallet),
		listOutputsCalls: () => listOutputsCalls,
		getPublicKeyCalls: () => getPublicKeyCalls,
		createActionCalls: () => createActionCalls,
		createSignatureCalls: () => createSignatureCalls,
	};
}

const SAMPLE_ARGS: CreateOrdinalsArgs = {
	dataB64: Buffer.from("sigma-preflight", "utf8").toString("base64"),
	contentType: "text/plain",
};

const originalBroadcasting = process.env.DISABLE_BROADCASTING;

afterEach(() => {
	if (originalBroadcasting === undefined)
		delete process.env.DISABLE_BROADCASTING;
	else process.env.DISABLE_BROADCASTING = originalBroadcasting;
});

describe("wallet_createOrdinals Sigma preflight", () => {
	test("unpublished identity fails before any transaction or signature activity", async () => {
		delete process.env.DISABLE_BROADCASTING;
		const wallet = syntheticWallet([]);
		const executeMock = spyOn(inscribe, "execute").mockImplementation(
			async () => {
				throw new Error(
					"inscribe.execute should not run before Sigma preflight",
				);
			},
		);
		try {
			const call = captureHandler(wallet.ctx);
			const result = await call({ ...SAMPLE_ARGS, signWithBAP: true });

			expect(result.isError).toBe(true);
			const text = JSON.stringify(result.content);
			expect(text).toContain(BAP_IDENTITY_NOT_PUBLISHED);
			expect(text).toMatch(/not published/i);
			expect(wallet.createActionCalls()).toBe(0);
			expect(wallet.createSignatureCalls()).toBe(0);
			expect(executeMock).toHaveBeenCalledTimes(0);
		} finally {
			executeMock.mockRestore();
		}
	});

	test("published identity proceeds to inscribe.execute with the same context", async () => {
		delete process.env.DISABLE_BROADCASTING;
		const wallet = syntheticWallet([1, 2]);
		const executeMock = spyOn(inscribe, "execute").mockResolvedValue({
			txid: `${"22".repeat(32)}`,
			contentHash: "abc123",
		});
		try {
			const call = captureHandler(wallet.ctx);
			const result = await call({ ...SAMPLE_ARGS, signWithBAP: true });

			expect(result.isError).not.toBe(true);
			expect(JSON.stringify(result.content)).toContain("22".repeat(32));
			expect(executeMock).toHaveBeenCalledTimes(1);
			const [seenCtx, seenRequest] = executeMock.mock.calls[0] as [
				OneSatContext,
				{ signWithBAP?: boolean },
			];
			expect(seenCtx).toBe(wallet.ctx);
			expect(seenRequest.signWithBAP).toBe(true);
			expect(wallet.listOutputsCalls()).toBeGreaterThan(0);
		} finally {
			executeMock.mockRestore();
		}
	});

	test("unsigned path bypasses identity lookup", async () => {
		delete process.env.DISABLE_BROADCASTING;
		const wallet = syntheticWallet([]);
		const executeMock = spyOn(inscribe, "execute").mockResolvedValue({
			txid: `${"33".repeat(32)}`,
		});
		try {
			const call = captureHandler(wallet.ctx);
			const result = await call({ ...SAMPLE_ARGS });

			expect(result.isError).not.toBe(true);
			expect(executeMock).toHaveBeenCalledTimes(1);
			expect(wallet.listOutputsCalls()).toBe(0);
			expect(wallet.getPublicKeyCalls()).toBe(0);
		} finally {
			executeMock.mockRestore();
		}
	});

	test("broadcast-disabled gate still wins before wallet work", async () => {
		process.env.DISABLE_BROADCASTING = "true";
		const wallet = syntheticWallet([1]);
		const executeMock = spyOn(inscribe, "execute").mockResolvedValue({
			txid: `${"44".repeat(32)}`,
		});
		try {
			const call = captureHandler(wallet.ctx);
			const result = await call({ ...SAMPLE_ARGS, signWithBAP: true });

			expect(result.isError).toBe(true);
			expect(JSON.stringify(result.content)).toContain("DISABLE_BROADCASTING");
			expect(executeMock).toHaveBeenCalledTimes(0);
			expect(wallet.listOutputsCalls()).toBe(0);
			expect(wallet.createActionCalls()).toBe(0);
			expect(wallet.createSignatureCalls()).toBe(0);
		} finally {
			executeMock.mockRestore();
		}
	});
});

test("separate missing or disabled identity never uses a published funding identity", async () => {
	delete process.env.DISABLE_BROADCASTING;
	for (const selected of [syntheticWallet([]).ctx, null]) {
		const assets = syntheticWallet([1]);
		const result = await captureHandler(
			assets.ctx,
			selected,
		)({ ...SAMPLE_ARGS, signWithBAP: true });
		expect(result.isError).toBe(true);
		expect(assets.listOutputsCalls()).toBe(0);
		expect(assets.createActionCalls()).toBe(0);
		expect(assets.createSignatureCalls()).toBe(0);
	}
});
