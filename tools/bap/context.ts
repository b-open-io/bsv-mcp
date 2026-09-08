import {
	attest,
	BAP_PROTOCOL_ID,
	computeBapId,
	getProfile,
	type OneSatContext,
	publishIdentity,
	resolveBapId,
	rotateIdentity,
	updateProfile,
} from "@1sat/actions";
import { PublicKey } from "@bsv/sdk";
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { assertBroadcastAllowed } from "../../utils/broadcastGuard";
import { registerTool } from "../utils/toolRegistration";

const response = (value: unknown): CallToolResult => ({
	content: [{ type: "text", text: JSON.stringify(value) }],
	...(value && typeof value === "object" && "error" in value && value.error
		? { isError: true }
		: {}),
});

/** Identity keys and signing remain inside the selected BRC-100 provider. */
export function registerContextBapTools(
	server: McpServer,
	ctx: OneSatContext,
	disableBroadcasting = false,
) {
	function register<T>(
		name: string,
		description: string,
		schema: z.ZodSchema<T>,
		execute: (input: T) => Promise<unknown>,
		broadcast: boolean,
		readOnly = false,
	) {
		registerTool<T>(server, {
			name,
			description,
			schema,
			annotations: {
				readOnlyHint: readOnly,
				destructiveHint: !readOnly,
				idempotentHint: readOnly,
				openWorldHint: broadcast,
			},
			handler: async (input) => {
				try {
					if (broadcast) assertBroadcastAllowed(name, disableBroadcasting);
					return response(await execute(input));
				} catch (error) {
					return response({
						error: error instanceof Error ? error.message : String(error),
					});
				}
			},
		});
	}
	register(
		"bap_getIdentity",
		"Read the selected identity wallet's deterministic BAP ID, publication status and root signing address. Uses BRC-100 derivation; exports no private keys.",
		z.object({}),
		async () => {
			const { publicKey } = await ctx.wallet.getPublicKey({
				protocolID: BAP_PROTOCOL_ID,
				keyID: "identity-0",
				counterparty: "self",
			});
			return {
				bapId: await computeBapId(ctx),
				published: (await resolveBapId(ctx)) !== null,
				rootPublicKey: publicKey,
				rootAddress: PublicKey.fromString(publicKey).toAddress(),
			};
		},
		false,
		true,
	);
	register(
		"bap_publishIdentity",
		"Publish the selected identity wallet's BAP ID with an AIP signature. The identity wallet funds the transaction and retains its BAP records; its signer controls approval.",
		z.object({}),
		(input) => publishIdentity.execute(ctx, input),
		true,
	);
	register(
		"bap_rotateIdentity",
		"Rotate the selected identity wallet's BAP signing key, publish its signed successor record, and retire the preceding wallet record.",
		z.object({}),
		(input) => rotateIdentity.execute(ctx, input),
		true,
	);
	register(
		"bap_attest",
		"Publish a BAP attestation signed by the selected identity wallet's current derived signing key.",
		z.object({
			attestationHash: z.string().regex(/^[0-9a-f]{64}$/i),
			counter: z.string().regex(/^\d+$/).max(20).optional(),
		}),
		(input) => attest.execute(ctx, input),
		true,
	);
	register(
		"bap_updateProfile",
		"Publish a BAP profile using the selected identity wallet. Publishes its initial identity if needed. Profile data becomes public on chain.",
		z.object({
			profile: z
				.record(z.string(), z.unknown())
				.refine(
					(value) => Buffer.byteLength(JSON.stringify(value)) <= 100_000,
					"Profile exceeds 100 KB",
				),
		}),
		(input) => updateProfile.execute(ctx, input),
		true,
	);
	register(
		"bap_getProfile",
		"Read the current profile from the selected identity wallet's BAP basket. The SDK also relinquishes duplicate stale profile records in that wallet.",
		z.object({}),
		(input) => getProfile.execute(ctx, input),
		false,
	);
}
