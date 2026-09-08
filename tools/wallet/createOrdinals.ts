import type { OneSatContext } from "@1sat/actions";
import { inscribe } from "@1sat/actions";
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { assertBroadcastAllowed } from "../../utils/broadcastGuard";
import { withSigmaIdentity } from "../../utils/sigmaRoleContext";
import {
	isSigmaSigningContextError,
	resolveSigmaSigningContext,
} from "../../utils/sigmaSigningContext";

export const createOrdinalsArgsSchema = z.object({
	dataB64: z.string().describe("Base64-encoded content to inscribe"),
	contentType: z.string().describe("MIME type of the content"),
	destinationAddress: z
		.string()
		.optional()
		.describe("Optional destination address for the ordinal"),
	metadata: z
		.record(z.string(), z.string())
		.optional()
		.describe("Optional MAP metadata for the inscription"),
	signWithBAP: z
		.boolean()
		.optional()
		.describe(
			"Add a SIGMA data signature using the current BAP identity key. Uses anchor+inscription two-step flow.",
		),
});

export type CreateOrdinalsArgs = z.infer<typeof createOrdinalsArgsSchema>;

export function registerCreateOrdinalsTool(
	server: McpServer,
	ctx: OneSatContext | undefined,
	identityContext?: OneSatContext | null,
) {
	server.registerTool(
		"wallet_createOrdinals",
		{
			description:
				"Creates and inscribes ordinals (NFTs) on the Bitcoin SV blockchain. This tool lets you mint new digital artifacts by encoding data directly into the blockchain. Supports various content types including images, text, JSON, and HTML. The tool handles transaction creation, fee calculation, and broadcasting.",
			inputSchema: createOrdinalsArgsSchema,
		},
		async ({
			dataB64,
			contentType,
			destinationAddress,
			metadata,
			signWithBAP,
		}): Promise<CallToolResult> => {
			if (!ctx) {
				return {
					content: [
						{
							type: "text",
							text: "Wallet not initialized. Please configure a wallet before creating ordinals.",
						},
					],
					isError: true,
				};
			}

			try {
				assertBroadcastAllowed("wallet_createOrdinals");
				let signingCtx = ctx;
				if (signWithBAP === true) {
					if (identityContext === null)
						throw new Error("No identity key is assigned for SIGMA signing.");
					if (identityContext)
						signingCtx = withSigmaIdentity(ctx, identityContext);
					try {
						await resolveSigmaSigningContext(signingCtx);
					} catch (preflight: unknown) {
						if (isSigmaSigningContextError(preflight)) {
							return {
								content: [
									{
										type: "text",
										text: `[${preflight.code}] ${preflight.message}`,
									},
								],
								isError: true,
							};
						}
						throw preflight;
					}
				}
				const result = await inscribe.execute(signingCtx, {
					base64Content: dataB64,
					contentType,
					map: metadata,
					signWithBAP,
					// Without this the inscription locks to a wallet-derived self
					// key, so a caller-supplied address has to be forwarded or the
					// ordinal silently mints to the wrong owner.
					...(destinationAddress && {
						destination: { address: destinationAddress },
					}),
				});

				if (result.error) {
					return {
						content: [{ type: "text", text: result.error }],
						isError: true,
					};
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								txid: result.txid,
								contentHash: result.contentHash,
								contentType,
							}),
						},
					],
				};
			} catch (err: unknown) {
				return {
					content: [
						{
							type: "text",
							text: err instanceof Error ? err.message : String(err),
						},
					],
					isError: true,
				};
			}
		},
	);
}
