import {
	applyBapAip,
	executeTrackedAction,
	type OneSatContext,
	resolveCurrentKeyId,
} from "@1sat/actions";
import type { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { assertBroadcastAllowed } from "../../utils/broadcastGuard";
import { signOpReturnWithAIP } from "../utils/aip";
import { registerTool } from "../utils/toolRegistration";
import {
	buildAndSendTransaction,
	buildOpReturnScript,
} from "../utils/transactionBuilder";
import type { Wallet } from "../wallet/wallet";
import { socialActionSchema, socialOutputs } from "./schema";

export interface SocialWriter {
	identityContext?: OneSatContext;
	wallet?: Wallet;
	identityKey?: PrivateKey;
	disableBroadcasting?: boolean;
}
export const socialPublishSchema = z.strictObject({
	action: socialActionSchema,
	preview: z
		.boolean()
		.default(false)
		.describe(
			"Return unsigned output scripts without signing, funding, or broadcasting.",
		),
});

export async function publishSocial(
	input: z.input<typeof socialPublishSchema>,
	config: SocialWriter,
) {
	const { action, preview } = socialPublishSchema.parse(input);
	// Refuse a disabled publication before touching keys or accessing the network.
	if (!preview)
		assertBroadcastAllowed("bsocial_publish", config.disableBroadcasting);
	const { scripts, outputs } = socialOutputs(action);
	if (preview)
		return {
			preview: true,
			type: action.type,
			outputs: scripts.map((script) => ({
				lockingScript: script.toHex(),
				satoshis: 0,
			})),
			notice:
				"Unsigned public on-chain data. No transaction has been funded or broadcast.",
		};
	if (config.identityContext) {
		const ctx = config.identityContext;
		// Pin one BAP signing key for the primary record and every supplemental output.
		const keyID = await resolveCurrentKeyId(ctx);
		const signed = [];
		for (const script of scripts)
			signed.push(await applyBapAip(ctx, script, keyID));
		const result = await executeTrackedAction(ctx.wallet, {
			description: `BSocial ${action.type}`,
			outputs: signed.map((script, index) => ({
				lockingScript: script.toHex(),
				satoshis: 0,
				outputDescription:
					index === 0 ? `BSocial ${action.type}` : "BSocial supplement",
				basket: "bsocial",
				tags: [`app:${action.app}`, `type:${action.type}`],
			})),
			options: { acceptDelayedBroadcast: false, randomizeOutputs: false },
		});
		if (result.error) throw new Error(result.error);
		if (!result.txid)
			throw new Error(
				"Wallet did not return a transaction ID; inspect wallet activity before retrying",
			);
		return { type: action.type, txid: result.txid, outputCount: signed.length };
	}
	const wallet = config.wallet;
	const identityKey = config.identityKey ?? wallet?.getIdentityKey();
	if (!wallet || !identityKey)
		throw new Error(
			"Social publishing requires an identity wallet or explicit legacy identity key. A payment key is not an author identity.",
		);
	const paymentKey = wallet.getPaymentKey();
	if (!paymentKey)
		throw new Error("Payment key is unavailable for transaction fees");
	const signed = [];
	for (const fields of outputs) {
		const { signedData } = await signOpReturnWithAIP(
			fields,
			identityKey,
			identityKey.toAddress(),
		);
		signed.push(buildOpReturnScript(signedData));
	}
	const { paymentUtxos } = await wallet.getUtxos();
	const result = await buildAndSendTransaction({
		outputs: signed.map((script) => ({ script, satoshis: 0 })),
		utxos: paymentUtxos,
		changeAddress: paymentKey.toAddress(),
		paymentKey,
	});
	if (!result.success)
		throw new Error(result.error ?? "Social transaction failed");
	return { type: action.type, txid: result.txid, outputCount: signed.length };
}

export function registerSocialPublishTool(
	server: McpServer,
	config: SocialWriter,
) {
	registerTool(server, {
		name: "bsocial_publish",
		schema: socialPublishSchema,
		description:
			"Publish a signed Bitcoin Schema social action: post/reply, repost, like/unlike, follow/unfollow, friend/unfriend, message, or video. Posts/messages support context, tags and attachments. Content is public and permanent; recipient context does NOT encrypt a message. Friend records require your communication public key from an established key-agreement workflow. Requires the selected BAP identity wallet or explicit legacy identity key and funding. Use preview to inspect unsigned outputs without spending.",
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: true,
		},
		handler: async (input) => {
			const result = await publishSocial(input, config);
			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
				structuredContent: result,
			};
		},
	});
}
