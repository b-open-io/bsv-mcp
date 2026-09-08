import { describe, expect, test } from "bun:test";
import {
	appendSigmaPlaceholder,
	BAP_PROTOCOL_ID,
	createContext,
	type OneSatContext,
	sealSigma,
	type WalletInterface,
} from "@1sat/actions";
import { Sigma } from "@1sat/templates";
import {
	KeyDeriver,
	OP,
	PrivateKey,
	ProtoWallet,
	Script,
	Transaction,
	Utils,
} from "@bsv/sdk";
import {
	BAP_IDENTITY_NOT_PUBLISHED,
	isSigmaSigningContextError,
	resolveSigmaSigningContext,
	SIGMA_CONTEXT_MISSING,
	SigmaSigningContextError,
} from "./sigmaSigningContext";

function syntheticContext(root: PrivateKey, seqs: number[]) {
	const proto = new ProtoWallet(new KeyDeriver(root));
	const wallet = proto as unknown as WalletInterface;
	const getPublicKeyArgs: unknown[] = [];
	let createSignatureCalls = 0;
	const innerGetPublicKey = proto.getPublicKey.bind(proto);
	wallet.getPublicKey = async (args) => {
		getPublicKeyArgs.push(args);
		return innerGetPublicKey(args);
	};
	const innerCreateSignature = proto.createSignature.bind(proto);
	wallet.createSignature = async (args) => {
		createSignatureCalls += 1;
		return innerCreateSignature(args);
	};
	wallet.listOutputs = async () => ({
		totalOutputs: seqs.length,
		outputs: seqs.map((seq, index) => ({
			satoshis: 1,
			spendable: true,
			tags: ["type:id", `seq:${seq}`],
			outpoint: `${"11".repeat(32)}.${index}`,
		})),
	});
	const ctx = createContext(wallet);
	return {
		ctx,
		getPublicKeyArgs,
		createSignatureCalls: () => createSignatureCalls,
	};
}

describe("resolveSigmaSigningContext", () => {
	test("resolves the highest current BAP key with the exact self derivation", async () => {
		const root = PrivateKey.fromRandom();
		const { ctx, getPublicKeyArgs } = syntheticContext(root, [1, 4, 2]);
		const result = await resolveSigmaSigningContext(ctx);
		expect(result.protocolID).toEqual([1, "sigma"]);
		expect(result.keyID).toBe("identity-4");
		const expected = new KeyDeriver(root)
			.derivePublicKey(BAP_PROTOCOL_ID, "identity-4", "self", true)
			.toString();
		expect(result.publicKey).toBe(expected);
		expect(getPublicKeyArgs).toHaveLength(1);
		expect(getPublicKeyArgs[0]).toEqual({
			protocolID: BAP_PROTOCOL_ID,
			keyID: "identity-4",
			forSelf: true,
		});
	});

	test("sealed Sigma output verifies against the resolved key", async () => {
		const root = PrivateKey.fromRandom();
		const { ctx } = syntheticContext(root, [1, 2]);
		const resolved = await resolveSigmaSigningContext(ctx);
		expect(resolved.keyID).toBe("identity-2");
		const base = new Script();
		base.writeOpCode(OP.OP_RETURN);
		base.writeBin(Utils.toArray("sigma-signing-context", "utf8"));
		const anchorTxid = "22".repeat(32);
		const placeholder = await appendSigmaPlaceholder(ctx, base, 0);
		const sealed = await sealSigma(
			ctx,
			placeholder,
			{ txid: anchorTxid, vout: 0 },
			0,
			0,
		);
		const tx = new Transaction();
		tx.addInput({ sourceTXID: anchorTxid, sourceOutputIndex: 0 });
		tx.addOutput({ lockingScript: sealed, satoshis: 1, change: false });
		expect(Sigma.verifyTransaction(tx, 0)).toBe(true);
	});

	test("empty BAP basket throws before any signing is possible", async () => {
		const root = PrivateKey.fromRandom();
		const { ctx, createSignatureCalls } = syntheticContext(root, []);
		const error = await resolveSigmaSigningContext(ctx).catch((e) => e);
		expect(isSigmaSigningContextError(error)).toBe(true);
		expect(error).toBeInstanceOf(SigmaSigningContextError);
		expect((error as SigmaSigningContextError).code).toBe(
			BAP_IDENTITY_NOT_PUBLISHED,
		);
		expect((error as SigmaSigningContextError).message).toMatch(
			/not published/i,
		);
		expect(createSignatureCalls()).toBe(0);
	});

	test("missing context throws a distinct typed error", async () => {
		expect(BAP_IDENTITY_NOT_PUBLISHED).not.toBe(SIGMA_CONTEXT_MISSING);
		const error = await resolveSigmaSigningContext(undefined).catch((e) => e);
		expect(isSigmaSigningContextError(error)).toBe(true);
		expect(error).toBeInstanceOf(SigmaSigningContextError);
		expect((error as SigmaSigningContextError).code).toBe(
			SIGMA_CONTEXT_MISSING,
		);
	});

	test("unrelated wallet errors pass through unlabeled", async () => {
		const root = PrivateKey.fromRandom();
		const { ctx } = syntheticContext(root, [1]);
		const transportFailure = new Error("boom: basket storage offline");
		(ctx.wallet as WalletInterface).listOutputs = async () => {
			throw transportFailure;
		};
		const error: unknown = await resolveSigmaSigningContext(
			ctx as OneSatContext,
		).catch((e: unknown) => e);
		expect(isSigmaSigningContextError(error)).toBe(false);
		expect(error).toBe(transportFailure);
	});
});
