import {
	type BroadcastFailure,
	type BroadcastResponse,
	P2PKH,
	PrivateKey,
	SatoshisPerKilobyte,
	Script,
	Transaction,
	Utils,
	fromUtxo,
	isBroadcastFailure,
	isBroadcastResponse,
} from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { BAP, MemberID } from "bsv-bap";
import { z } from "zod";
import { BsocialBroadcaster } from "../../utils/broadcaster";
import {
	friendPrivateKeyFromMemberIdKey,
	friendPublicKeyFromSeedString,
} from "../../utils/keys";
import { MAP_PREFIX } from "../constants";
import {
	fetchPaymentUtxos,
	fetchPaymentUtxosFromV5,
} from "../wallet/fetchPaymentUtxos";
import type { Wallet } from "../wallet/wallet";

const { toArray, toHex } = Utils;

const APP_DOMAIN = "bsv-mcp";

export const bapFriendArgsSchema = z.object({
	targetBapId: z.string().min(1, "targetBapId is required."),
});

export type BapFriendArgs = z.infer<typeof bapFriendArgsSchema>;

export interface BapFriendConfig {
	disableBroadcasting?: boolean;
}

export function registerBapFriendTool(
	server: McpServer,
	wallet: Wallet,
	xprv: string,
	config?: BapFriendConfig,
) {
	server.tool(
		"bap_friend",
		"Initiates a friend request to another BAP ID by broadcasting an on-chain MAP transaction.",
		{ args: bapFriendArgsSchema },
		async (
			{ args }: { args: BapFriendArgs },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		): Promise<CallToolResult> => {
			const { targetBapId } = args;
			const logFunc = console.error;

			try {
				// --- Preconditions ---
				if (!xprv) {
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: "Server does not have a BAP master key (xprv). Cannot derive friend public key.",
							},
						],
					};
				}

				const payPk = wallet.getPaymentKey();
				const identityPk = wallet.getIdentityKey();

				if (!identityPk || !payPk) {
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: !payPk
									? "Wallet private key not available. Cannot fund friend request transaction."
									: "Wallet identity key not available. Cannot derive friend public key.",
							},
						],
					};
				}

				// 3. Derive Initial Identity
				const bap = new BAP(xprv);
				const idpk = PrivateKey.fromWif(
					bap.newId().exportMemberBackup().derivedPrivateKey,
				);
				const identityInstance = new MemberID(idpk);
				const paymentAddress = payPk.toAddress();

				// --- Derive friend public key ---
				const friendPubKey = friendPrivateKeyFromMemberIdKey(
					identityPk,
					targetBapId,
				)
					.toPublicKey()
					.toString();

				// --- Build MAP payload ---
				const payloadParts: (string | number[])[] = [
					MAP_PREFIX,
					"SET",
					"app",
					APP_DOMAIN,
					"type",
					"friend",
					"bapID",
					targetBapId,
					"publicKey",
					friendPubKey,
				];

				const payloadBuffers = payloadParts.map(
					(part) => toArray(part) as number[],
				);

				const signedBuffers =
					identityInstance.signOpReturnWithAIP(payloadBuffers);
				const payloadHex = signedBuffers.map((b) => toHex(b));
				const asmPayload = `OP_0 ${payloadHex.join(" ")}`;
				const opReturnScript = Script.fromASM(asmPayload);

				// --- Build Transaction ---
				const tx = new Transaction();
				tx.addOutput({ lockingScript: opReturnScript, satoshis: 0 });

				// --- Fund transaction ---
				const utxos = await fetchPaymentUtxosFromV5(paymentAddress);
				if (!utxos || utxos.length === 0) {
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: `No UTXOs available for payment address ${paymentAddress}. Cannot send friend request.`,
							},
						],
					};
				}

				const feeModel = new SatoshisPerKilobyte(10);
				let totalInput = 0n;
				let estFee = await feeModel.computeFee(tx);

				for (const utxo of utxos) {
					if (totalInput >= BigInt(estFee)) break;

					const unlockTemplate = new P2PKH().unlock(
						payPk,
						"all",
						false,
						utxo.satoshis,
						Script.fromBinary(toArray(utxo.script, "hex")),
					);

					const input = fromUtxo(utxo, unlockTemplate);
					tx.addInput(input);
					totalInput += BigInt(utxo.satoshis);
					estFee = await feeModel.computeFee(tx);
				}

				if (totalInput < BigInt(estFee)) {
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: `Not enough funds to cover fee. Needed ${estFee}, have ${totalInput}.`,
							},
						],
					};
				}

				const change = totalInput - BigInt(estFee);
				if (change > 0n) {
					tx.addOutput({
						lockingScript: new P2PKH().lock(paymentAddress),
						satoshis: Number(change),
						change: true,
					});
				}

				await tx.fee(feeModel);
				await tx.sign();

				const txHex = tx.toHex();
				const txid = tx.id("hex");

				if (config?.disableBroadcasting) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									success: true,
									disabledBroadcast: true,
									txid,
									rawTx: txHex,
									message: `Broadcasting disabled. Friend request transaction built for ${targetBapId}.`,
								}),
							},
						],
					};
				}

				// --- Broadcast ---
				const broadcaster = new BsocialBroadcaster();
				const broadcastResult = await tx.broadcast(broadcaster);

				let success = true;
				let errorMsg: string | undefined;
				let resultTxid = txid;

				if (isBroadcastResponse(broadcastResult as BroadcastResponse)) {
					resultTxid = (broadcastResult as BroadcastResponse).txid;
				} else if (isBroadcastFailure(broadcastResult as BroadcastFailure)) {
					success = false;
					const failure = broadcastResult as BroadcastFailure;
					errorMsg = `Broadcast failed: ${failure.description} (Code: ${failure.code})`;
					if (failure.txid) resultTxid = failure.txid;
				}

				return {
					isError: !success,
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success,
								txid: resultTxid,
								rawTx: txHex,
								message: success
									? `Friend request sent to ${targetBapId}.`
									: (errorMsg ?? "Broadcast failed"),
							}),
						},
					],
				};
			} catch (err) {
				const errMsg = err instanceof Error ? err.message : String(err);
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Failed to send friend request: ${errMsg}`,
						},
					],
				};
			}
		},
	);
}
