import { expect, test } from "bun:test";
import { createContext } from "@1sat/actions";
import type { OneSatServices } from "@1sat/client";
import { BSV21 } from "@1sat/templates";
import {
	Beef,
	type CreateActionArgs,
	LockingScript,
	P2PKH,
	PrivateKey,
	ProtoWallet,
	Transaction,
	UnlockingScript,
	Utils,
	type WalletInterface,
} from "@bsv/sdk";
import { createAppSweep } from "./appSweep";

function fixture(type: "bsv" | "ordinals" | "bsv21", altered = false) {
	const sourceKey = PrivateKey.fromHex("31");
	const destination = PrivateKey.fromHex("32");
	const tokenId = `${"a".repeat(64)}_0`;
	const source = new Transaction();
	for (let i = 0; i < 2; i++)
		source.addOutput({
			satoshis: type === "bsv" ? 1000 + i : 1,
			lockingScript:
				type === "bsv21"
					? BSV21.transfer(tokenId, BigInt((i + 1) * 100)).lock(
							new P2PKH().lock(sourceKey.toAddress()),
						)
					: new P2PKH().lock(sourceKey.toAddress()),
		});
	const inputs = source.outputs.map((output, index) => ({
		outpoint: `${source.id("hex")}_${index}`,
		satoshis: output.satoshis!,
		lockingScript: output.lockingScript.toHex(),
	}));
	let creates = 0,
		signs = 0,
		aborts = 0;
	let createdArgs: CreateActionArgs | undefined;
	const wallet = new ProtoWallet(destination) as unknown as WalletInterface;
	wallet.listOutputs = async () => ({ totalOutputs: 0, outputs: [] });
	wallet.abortAction = async () => {
		aborts++;
		return { aborted: true };
	};
	wallet.createAction = async (args) => {
		creates++;
		createdArgs = args;
		const tx = new Transaction();
		for (const input of args.inputs ?? [])
			tx.addInput({
				sourceTransaction: source,
				sourceOutputIndex: Number(input.outpoint.split(".")[1]),
				unlockingScript: new UnlockingScript(),
				sequence: 0xffffffff,
			});
		for (const output of args.outputs ?? [])
			tx.addOutput({
				satoshis: output.satoshis,
				lockingScript: LockingScript.fromHex(output.lockingScript),
			});
		if (type === "bsv")
			tx.addOutput({
				satoshis: 1900,
				lockingScript: new P2PKH().lock(destination.toAddress()),
			});
		if (altered) tx.outputs.reverse();
		return {
			signableTransaction: {
				reference: "provider-reference",
				tx: tx.toAtomicBEEF(),
			},
		};
	};
	wallet.signAction = async () => {
		signs++;
		return { txid: "b".repeat(64) };
	};
	const services = {
		getBeefForTxid: async () => {
			const beef = new Beef();
			beef.mergeTransaction(source);
			return beef;
		},
		ordfs: {
			bulkMetadata: async () =>
				type === "bsv"
					? {}
					: Object.fromEntries(
							inputs.map((value) => [
								`${value.outpoint}:-2`,
								{
									origin: value.outpoint,
									contentType: "image/png",
									contentLength: 1,
								},
							]),
						),
		},
		bsv21: {
			getTokenDetails: async () => ({
				token: { sym: "TEST", dec: 0 },
				status: {
					is_active: true,
					fee_address: PrivateKey.fromHex("33").toAddress(),
					fee_per_output: 0,
				},
			}),
			validateOutputs: async () =>
				inputs.map((value) => ({ outpoint: value.outpoint })),
		},
	} as unknown as OneSatServices;
	const ctx = createContext(wallet, { chain: "test", services });
	return {
		sourceKey,
		destination,
		tokenId,
		inputs,
		ctx,
		counts: () => ({ creates, signs, aborts }),
		args: () => createdArgs,
	};
}

async function browserSign(
	prepared: Awaited<ReturnType<ReturnType<typeof createAppSweep>["prepare"]>>,
	key: PrivateKey,
) {
	const tx = Transaction.fromBEEF(Utils.toArray(prepared.txHex, "hex"));
	for (const value of prepared.inputsToSign) {
		tx.inputs[value.index]!.unlockingScriptTemplate = new P2PKH().unlock(
			key,
			"all",
			true,
			value.satoshis,
			LockingScript.fromHex(value.lockingScript),
		);
	}
	await tx.sign();
	return Object.fromEntries(
		prepared.inputsToSign.map((value) => [
			String(value.index),
			{ unlockingScript: tx.inputs[value.index]?.unlockingScript?.toHex() ?? "" },
		]),
	);
}

for (const type of ["bsv", "ordinals", "bsv21"] as const)
	test(`browser sweep preserves ${type}, checks real signatures and submits once`, async () => {
		const f = fixture(type);
		const sweep = createAppSweep(f.ctx);
		const prepared = await sweep.prepare(
			{ sweepType: type, inputs: f.inputs },
			"owner",
		);
		expect(prepared.reference).not.toBe("provider-reference");
		expect(prepared.inputsToSign).toHaveLength(2);
		const tx = Transaction.fromBEEF(Utils.toArray(prepared.txHex, "hex"));
		if (type === "ordinals") {
			expect(tx.outputs.map((output) => output.satoshis)).toEqual([1, 1]);
			expect(
				f
					.args()
					?.outputs?.every(
						(output) =>
							output.basket === "1sat" &&
							JSON.parse(output.customInstructions!).counterparty === "self",
					),
			).toBe(true);
		}
		if (type === "bsv21") {
			const token = BSV21.decode(tx.outputs[0]?.lockingScript);
			expect(token?.tokenData).toMatchObject({
				id: f.tokenId,
				amt: "300",
				op: "transfer",
			});
			expect(f.args()?.outputs?.[0]?.basket).toBe("bsv21");
		}
		const spends = await browserSign(prepared, f.sourceKey);
		await expect(
			sweep.complete(prepared.reference, spends, "someone-else"),
		).rejects.toThrow("unauthorized");
		await expect(
			sweep.complete(
				prepared.reference,
				{ ...spends, "99": { unlockingScript: "00" } },
				"owner",
			),
		).rejects.toThrow("exactly");
		await expect(
			sweep.complete(
				prepared.reference,
				{ ...spends, "0": { unlockingScript: "00" } },
				"owner",
			),
		).rejects.toThrow();
		expect(f.counts().signs).toBe(0);
		// New HTTP request/server instance shares only the bound pending action.
		const nextRequest = createAppSweep(f.ctx);
		expect(
			await nextRequest.complete(prepared.reference, spends, "owner"),
		).toMatchObject({ success: true });
		await expect(
			nextRequest.complete(prepared.reference, spends, "owner"),
		).rejects.toThrow("already");
		expect(f.counts()).toEqual({ creates: 1, signs: 1, aborts: 0 });
	});

test("sweep rejects forged sources, duplicate inputs and signer reordering before broadcast", async () => {
	const f = fixture("ordinals", true);
	const sweep = createAppSweep(f.ctx);
	await expect(
		sweep.prepare(
			{ sweepType: "ordinals", inputs: [{ ...f.inputs[0]!, satoshis: 100 }] },
			"owner",
		),
	).rejects.toThrow("source transaction");
	await expect(
		sweep.prepare(
			{ sweepType: "ordinals", inputs: [f.inputs[0]!, f.inputs[0]!] },
			"owner",
		),
	).rejects.toThrow("Duplicate");
	expect(f.counts().creates).toBe(0);
	await expect(
		sweep.prepare({ sweepType: "ordinals", inputs: f.inputs }, "owner"),
	).rejects.toThrow("preservation output");
	expect(f.counts()).toEqual({ creates: 1, signs: 0, aborts: 1 });
});

test("asset sweep routes to the ordinals role and refuses unassigned payment roles", async () => {
	const f = fixture("ordinals");
	const other = createContext(
		new ProtoWallet(PrivateKey.fromHex("34")) as unknown as WalletInterface,
	);
	const sweep = createAppSweep(other, { ordinals: f.ctx });
	await expect(
		sweep.prepare({ sweepType: "bsv", inputs: f.inputs }, "owner"),
	).rejects.toThrow("payments");
	await sweep.prepare({ sweepType: "ordinals", inputs: f.inputs }, "owner");
	expect(f.counts().creates).toBe(1);
});
