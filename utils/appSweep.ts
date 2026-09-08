import { randomUUID } from "node:crypto";
import {
	applyP1SatCreateAction,
	BSV21_BASKET,
	bsv21FilterTags,
	buildBsv21CustomInstructions,
	buildOrdinalCustomInstructions,
	type OneSatContext,
	P1SAT_PROTOCOL,
	resolveOrdinalTags,
} from "@1sat/actions";
import { BSV21 } from "@1sat/templates";
import { buildTokenLabel } from "@1sat/types";
import {
	type CreateActionArgs,
	LockingScript,
	P2PKH,
	PublicKey,
	Spend,
	Transaction,
	UnlockingScript,
	Utils,
	type WalletInterface,
} from "@bsv/sdk";
import { z } from "zod";
import type { WalletRoleContexts } from "./walletRoles";

export const appSweepInputSchema = z.object({
	sweepType: z.enum(["bsv", "ordinals", "bsv21"]),
	inputs: z
		.array(
			z.object({
				outpoint: z.string().regex(/^[0-9a-f]{64}_[0-9]+$/i),
				satoshis: z.number().int().nonnegative().safe(),
				lockingScript: z.string().regex(/^(?:[0-9a-f]{2})+$/i),
			}),
		)
		.min(1)
		.max(100),
});
type SweepInput = z.infer<typeof appSweepInputSchema>;
type Pending = {
	wallet: WalletInterface;
	providerReference: string;
	principal: string;
	expiresAt: number;
	status: "pending" | "submitting" | "settled";
	tx: Transaction;
	inputsToSign: {
		index: number;
		outpoint: string;
		satoshis: number;
		lockingScript: string;
	}[];
};
const pendingByWallet = new WeakMap<WalletInterface, Map<string, Pending>>();

/** App signing retains its source key in the browser. Server state binds the exact action and owner. */
export function createAppSweep(ctx: OneSatContext, roles?: WalletRoleContexts) {
	const pending = pendingByWallet.get(ctx.wallet) ?? new Map<string, Pending>();
	pendingByWallet.set(ctx.wallet, pending);
	const cleanupExpired = async () => {
		for (const [id, entry] of pending)
			if (entry.expiresAt <= Date.now()) {
				pending.delete(id);
				if (entry.status === "pending")
					await entry.wallet
						.abortAction({ reference: entry.providerReference })
						.catch(() => {});
			}
	};
	return {
		async prepare(input: SweepInput, principal: string) {
			input = appSweepInputSchema.parse(input);
			await cleanupExpired();
			if (pending.size >= 256)
				throw new Error(
					"Too many retained sweeps; wait for pending sweeps to expire",
				);
			const selected = roles
				? input.sweepType === "bsv"
					? roles.payments
					: roles.ordinals
				: ctx;
			if (!selected)
				throw new Error(
					`No ${input.sweepType === "bsv" ? "payments" : "ordinals"} wallet role is assigned`,
				);
			if (!selected.services)
				throw new Error("Wallet services are unavailable");
			const { wallet, services } = selected;
			const outpoints = input.inputs.map((value) =>
				value.outpoint.toLowerCase(),
			);
			if (new Set(outpoints).size !== outpoints.length)
				throw new Error("Duplicate sweep input");
			const txids = [...new Set(outpoints.map((value) => value.slice(0, 64)))];
			const beef = await services.getBeefForTxid(txids[0]!);
			for (const txid of txids.slice(1))
				beef.mergeBeef(await services.getBeefForTxid(txid));
			const inputs = input.inputs.map((value, index) => {
				const outpoint = outpoints[index]!;
				const vout = Number(outpoint.slice(65));
				if (!Number.isSafeInteger(vout) || vout > 0xffffffff)
					throw new Error("Invalid source output index");
				const source = beef.findTxid(outpoint.slice(0, 64))?.tx;
				const output = source?.outputs[vout];
				if (
					!source ||
					source.id("hex") !== outpoint.slice(0, 64) ||
					!output ||
					output.satoshis !== value.satoshis ||
					output.lockingScript.toHex() !== value.lockingScript.toLowerCase()
				)
					throw new Error("Sweep input does not match its source transaction");
				if (input.sweepType !== "bsv" && output.satoshis !== 1)
					throw new Error(
						"Asset sweep requires one-satoshi inputs to preserve ordinal positions",
					);
				return {
					...value,
					outpoint,
					lockingScript: output.lockingScript.toHex(),
					satoshis: output.satoshis!,
				};
			});
			const metadata =
				input.sweepType === "bsv21"
					? {}
					: await services.ordfs.bulkMetadata(
							outpoints.map((value) => `${value}:-2`),
						);
			const outputs: NonNullable<CreateActionArgs["outputs"]> = [];
			const labels: string[] = [];
			if (input.sweepType === "bsv") {
				for (const value of inputs) {
					const meta =
						metadata[`${value.outpoint}:-2`] ?? metadata[value.outpoint];
					if (
						value.satoshis <= 1 ||
						!/^76a914[0-9a-f]{40}88ac$/.test(value.lockingScript) ||
						meta?.contentType
					)
						throw new Error(
							"An asset or non-P2PKH input cannot be swept as BSV funding",
						);
				}
			} else if (input.sweepType === "ordinals") {
				for (const value of inputs) {
					const meta =
						metadata[`${value.outpoint}:-2`] ?? metadata[value.outpoint];
					if (!meta?.origin || !meta.contentType)
						throw new Error(
							"Ordinal metadata is unavailable; retry when its origin can be verified",
						);
					if (
						meta.contentType.split(";")[0]?.trim() === "application/bsv-20" ||
						BSV21.decode(LockingScript.fromHex(value.lockingScript))
					)
						throw new Error("Token inputs require a BSV-21 sweep");
					const resolved = await resolveOrdinalTags(selected, value.outpoint, {
						contentType: meta.contentType,
						origin: meta.origin,
						map: meta.map,
						parent: meta.parent,
					});
					const { publicKey } = await wallet.getPublicKey({
						protocolID: P1SAT_PROTOCOL,
						keyID: value.outpoint,
						counterparty: "self",
						forSelf: true,
					});
					outputs.push({
						lockingScript: new P2PKH()
							.lock(PublicKey.fromString(publicKey).toAddress())
							.toHex(),
						satoshis: 1,
						outputDescription: `Sweep ordinal ${meta.origin}`,
						basket: resolved.basket,
						tags: resolved.tags,
						customInstructions: buildOrdinalCustomInstructions({
							protocolID: P1SAT_PROTOCOL,
							keyID: value.outpoint,
							counterparty: "self",
							tags: resolved.tags,
							name: resolved.name,
						}),
					});
				}
			} else {
				const tokens = inputs.map((value) => {
					const data = BSV21.decode(
						LockingScript.fromHex(value.lockingScript),
					)?.tokenData;
					if (
						!data ||
						!["deploy+mint", "mint", "transfer"].includes(data.op) ||
						!data.amt ||
						!/^[0-9]+$/.test(data.amt)
					)
						throw new Error("Input is not a transferable BSV-21 amount");
					return {
						id: data.op === "deploy+mint" ? value.outpoint : data.id,
						amount: BigInt(data.amt),
					};
				});
				const tokenId = tokens[0]?.id;
				if (
					!tokenId ||
					tokens.some((value) => value.id !== tokenId || value.amount <= 0n)
				)
					throw new Error(
						"Token sweep inputs must hold positive amounts of one token ID",
					);
				const details = await services.bsv21.getTokenDetails(tokenId);
				if (!details.status.is_active) throw new Error("Token is not active");
				const validated = await services.bsv21.validateOutputs(
					tokenId,
					outpoints,
					{ unspent: true },
				);
				if (
					outpoints.some(
						(value) =>
							!validated.some(
								(output) =>
									output.outpoint
										.replace(":", "_")
										.replace(".", "_")
										.toLowerCase() === value,
							),
					)
				)
					throw new Error("Token overlay did not validate every unspent input");
				const amount = tokens.reduce((sum, value) => sum + value.amount, 0n);
				const keyID = `${tokenId}-${randomUUID()}`;
				const { publicKey } = await wallet.getPublicKey({
					protocolID: P1SAT_PROTOCOL,
					keyID,
					counterparty: "self",
					forSelf: true,
				});
				outputs.push({
					lockingScript: BSV21.transfer(tokenId, amount)
						.lock(new P2PKH().lock(PublicKey.fromString(publicKey).toAddress()))
						.toHex(),
					satoshis: 1,
					outputDescription: `Sweep ${amount} tokens`,
					basket: BSV21_BASKET,
					tags: bsv21FilterTags({ tokenId }),
					customInstructions: buildBsv21CustomInstructions({
						token: {
							id: tokenId,
							amt: String(amount),
							op: "transfer",
							sym: details.token.sym,
							dec: details.token.dec ?? 0,
							icon: details.token.icon,
						},
						protocolID: P1SAT_PROTOCOL,
						keyID,
						counterparty: "self",
					}),
				});
				if (
					!Number.isSafeInteger(details.status.fee_per_output) ||
					details.status.fee_per_output < 0
				)
					throw new Error("Invalid token overlay fee");
				outputs.push({
					lockingScript: new P2PKH().lock(details.status.fee_address).toHex(),
					satoshis: details.status.fee_per_output,
					outputDescription: "Token overlay processing fee",
				});
				labels.push(buildTokenLabel(tokenId));
			}
			const args: CreateActionArgs = {
				description: `Sweep ${inputs.length} ${input.sweepType} inputs`,
				inputBEEF: beef.toBinary(),
				inputs: inputs.map((value) => ({
					outpoint: value.outpoint.replace("_", "."),
					inputDescription: "Browser-signed sweep input",
					unlockingScriptLength: 108,
					sequenceNumber: 0xffffffff,
				})),
				outputs,
				labels,
				options: { signAndProcess: false, randomizeOutputs: false },
			};
			await applyP1SatCreateAction(wallet, args);
			const created = await wallet.createAction(args);
			const action = created.signableTransaction;
			if (!action)
				throw new Error("Signer did not return an unsigned sweep transaction");
			try {
				const tx = Transaction.fromBEEF(action.tx);
				const inputsToSign = inputs.map((value) => {
					const indices = tx.inputs.flatMap((entry, index) =>
						`${entry.sourceTXID ?? entry.sourceTransaction?.id("hex")}.${entry.sourceOutputIndex}` ===
						value.outpoint.replace("_", ".")
							? [index]
							: [],
					);
					if (indices.length !== 1)
						throw new Error("Signer changed or omitted a sweep input");
					return { ...value, index: indices[0]! };
				});
				if (
					input.sweepType === "ordinals" &&
					inputsToSign.some((value, index) => value.index !== index)
				)
					throw new Error(
						"Signer reordered ordinal inputs; refusing to move their satoshis",
					);
				for (const [index, expected] of outputs.entries())
					if (
						tx.outputs[index]?.satoshis !== expected.satoshis ||
						tx.outputs[index]?.lockingScript.toHex() !== expected.lockingScript
					)
						throw new Error(
							"Signer changed or reordered a preservation output",
						);
				const reference = randomUUID();
				pending.set(reference, {
					wallet,
					providerReference: action.reference,
					principal,
					tx,
					inputsToSign,
					expiresAt: Date.now() + 600_000,
					status: "pending",
				});
				return { reference, txHex: Utils.toHex(action.tx), inputsToSign };
			} catch (error) {
				await wallet
					.abortAction({ reference: action.reference })
					.catch(() => {});
				throw error;
			}
		},
		async complete(
			reference: string,
			spends: Record<string, { unlockingScript: string }>,
			principal: string,
		) {
			await cleanupExpired();
			const entry = pending.get(reference);
			if (!entry || entry.principal !== principal)
				throw new Error("Unknown, expired or unauthorized sweep reference");
			if (entry.status !== "pending")
				throw new Error(
					"Sweep has already been submitted; check its transaction status before retrying",
				);
			if (
				Object.keys(spends).length !== entry.inputsToSign.length ||
				entry.inputsToSign.some(
					(value) => !Object.hasOwn(spends, String(value.index)),
				)
			)
				throw new Error(
					"Provide exactly the external input signatures from sweep preparation",
				);
			for (const value of entry.inputsToSign) {
				const script = spends[String(value.index)]?.unlockingScript;
				if (!/^(?:[0-9a-f]{2}){1,108}$/i.test(script))
					throw new Error("Invalid external unlocking script");
				const input = entry.tx.inputs[value.index]!;
				const spend = new Spend({
					sourceTXID: value.outpoint.slice(0, 64),
					sourceOutputIndex: input.sourceOutputIndex,
					sourceSatoshis: value.satoshis,
					lockingScript: LockingScript.fromHex(value.lockingScript),
					transactionVersion: entry.tx.version,
					otherInputs: entry.tx.inputs.filter(
						(_, index) => index !== value.index,
					),
					outputs: entry.tx.outputs,
					inputIndex: value.index,
					unlockingScript: UnlockingScript.fromHex(script),
					inputSequence: input.sequence ?? 0xffffffff,
					lockTime: entry.tx.lockTime,
				});
				if (!spend.validate())
					throw new Error(
						"External signature does not authorize the prepared sweep transaction",
					);
			}
			entry.status = "submitting";
			try {
				const result = await entry.wallet.signAction({
					reference: entry.providerReference,
					spends,
					options: { acceptDelayedBroadcast: false },
				});
				if (!result.txid)
					throw new Error(
						"Signer returned no transaction ID; check signer status before retrying",
					);
				return { txid: result.txid, success: true };
			} finally {
				entry.status = "settled";
			}
		},
	};
}
