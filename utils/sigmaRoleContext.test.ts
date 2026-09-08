import { expect, test } from "bun:test";
import {
	BAP_BASKET,
	BAP_PROTOCOL_ID,
	createContext,
	inscribe,
	P1SAT_PROTOCOL,
} from "@1sat/actions";
import { Sigma } from "@1sat/templates";
import {
	KeyDeriver,
	LockingScript,
	PrivateKey,
	ProtoWallet,
	Transaction,
	UnlockingScript,
	type WalletInterface,
} from "@bsv/sdk";
import { withSigmaIdentity } from "./sigmaRoleContext";
import { resolveSigmaSigningContext } from "./sigmaSigningContext";

test("SDK inscription pipeline signs SIGMA with identity and transaction inputs with ordinals", async () => {
	const assetRoot = PrivateKey.fromHex("01"),
		identityRoot = PrivateKey.fromHex("02");
	const assets = new ProtoWallet(
		new KeyDeriver(assetRoot),
	) as unknown as WalletInterface;
	const identity = new ProtoWallet(
		new KeyDeriver(identityRoot),
	) as unknown as WalletInterface;
	const assetSignatures: unknown[] = [];
	const identitySignatures: unknown[] = [];
	for (const [wallet, record] of [
		[assets, assetSignatures],
		[identity, identitySignatures],
	] as const) {
		const sign = wallet.createSignature.bind(wallet);
		wallet.createSignature = async (args) => {
			record.push(args.protocolID);
			return sign(args);
		};
	}
	identity.listOutputs = async (args) => {
		expect(args.basket).toBe(BAP_BASKET);
		return {
			totalOutputs: 1,
			outputs: [
				{
					outpoint: `${"11".repeat(32)}.0`,
					satoshis: 1,
					spendable: true,
					tags: ["type:id", "seq:2"],
				},
			],
		};
	};
	identity.createAction = async () => {
		throw new Error("identity must never fund");
	};
	identity.signAction = async () => {
		throw new Error("identity must never sign transaction inputs");
	};
	assets.listOutputs = async () => {
		throw new Error("BAP lookup must not use the asset wallet");
	};
	let anchor: Transaction | undefined, inscription: Transaction | undefined;
	function currentInscription() {
		if (!inscription) throw new Error("Inscription was not created");
		return inscription;
	}
	let assetCreates = 0,
		assetSigns = 0;
	assets.createAction = async (args) => {
		assetCreates++;
		const tx = new Transaction();
		for (const input of args.inputs ?? [])
			tx.addInput({
				sourceTransaction: anchor,
				sourceTXID: input.outpoint.split(".")[0],
				sourceOutputIndex: Number(input.outpoint.split(".")[1]),
				unlockingScript: new UnlockingScript(),
				sequence: 0xffffffff,
			});
		for (const out of args.outputs ?? [])
			tx.addOutput({
				lockingScript: LockingScript.fromHex(out.lockingScript),
				satoshis: out.satoshis,
			});
		if (args.description === "Sigma anchor output") {
			anchor = tx;
			return { txid: tx.id("hex"), tx: tx.toAtomicBEEF() };
		}
		inscription = tx;
		return {
			signableTransaction: { reference: "c2lnbWE=", tx: tx.toAtomicBEEF() },
		};
	};
	assets.signAction = async (args) => {
		assetSigns++;
		for (const [index, spend] of Object.entries(args.spends))
			currentInscription().inputs[Number(index)].unlockingScript =
				UnlockingScript.fromHex(spend.unlockingScript);
		return {
			txid: currentInscription().id("hex"),
			tx: currentInscription().toAtomicBEEF(),
		};
	};
	assets.abortAction = async () => {
		throw new Error("unexpected abort");
	};
	const ctx = withSigmaIdentity(createContext(assets), createContext(identity));
	const result = await inscribe.execute(ctx, {
		base64Content: Buffer.from("distinct signing roles").toString("base64"),
		contentType: "text/plain",
		signWithBAP: true,
	});
	expect(result.error).toBeUndefined();
	expect(assetCreates).toBe(2);
	expect(assetSigns).toBe(1);
	expect(identitySignatures).toEqual([BAP_PROTOCOL_ID]);
	expect(assetSignatures).toEqual([P1SAT_PROTOCOL]);
	expect(Sigma.verifyTransaction(currentInscription(), 0)).toBe(true);
	const signer = new KeyDeriver(identityRoot).derivePublicKey(
		BAP_PROTOCOL_ID,
		"identity-2",
		"self",
		true,
	);
	expect(
		Sigma.parseFromScript(currentInscription().outputs[0].lockingScript)[0]
			?.address,
	).toBe(signer.toAddress());
	expect(
		Sigma.parseFromScript(currentInscription().outputs[0].lockingScript)[0]
			?.address,
	).not.toBe(
		new KeyDeriver(assetRoot)
			.derivePublicKey(BAP_PROTOCOL_ID, "identity-2", "self", true)
			.toAddress(),
	);
});

test("missing identity record refuses preflight without consulting the funding identity", async () => {
	const assets = new ProtoWallet(
		PrivateKey.fromHex("01"),
	) as unknown as WalletInterface;
	const identity = new ProtoWallet(
		PrivateKey.fromHex("02"),
	) as unknown as WalletInterface;
	assets.listOutputs = async () => {
		throw new Error("wrong identity fallback");
	};
	identity.listOutputs = async () => ({ totalOutputs: 0, outputs: [] });
	await expect(
		resolveSigmaSigningContext(
			withSigmaIdentity(createContext(assets), createContext(identity)),
		),
	).rejects.toThrow("not published");
});
