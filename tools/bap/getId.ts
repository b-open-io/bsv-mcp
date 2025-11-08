import { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { BSOCIAL_API_URL } from "../constants";
import type { IdentityData, SigmaIdentityProfile } from "./types";

// Schema for bap_getId arguments
export const bapGetIdArgsSchema = z.object({
	idKey: z
		.string()
		.optional()
		.describe(
			"Optional Identity Key (Paymail or public key). If not provided, attempts to use the server's configured identity key.",
		),
});
export type BapGetIdArgs = z.infer<typeof bapGetIdArgsSchema>;

/**
 * Fetches the identity profile from Sigma API.
 * @param idKey The identity key (Paymail or public key) to fetch the profile for.
 * @returns The identity data, or null if not found.
 */
export const fetchProfile = async (
	idKey: string,
): Promise<IdentityData | null> => {
	const response = await fetch(`${BSOCIAL_API_URL}/identity/get`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ idKey }),
	});

	if (!response.ok) {
		// For 404, Sigma API might return a specific body, but generally, we treat it as profile not found.
		if (response.status === 404) {
			return null; // Explicitly return null for 404
		}
		const errorBody = await response.text();
		throw new Error(
			`Sigma API request failed with status ${response.status}: ${errorBody}`,
		);
	}

	try {
		const profileData = (await response.json()) as SigmaIdentityProfile;
		// Ensure result exists, even if it's null (which means not found)
		if (typeof profileData.result === "undefined") {
			throw new Error("Sigma API response is missing the 'result' field.");
		}
		return profileData.result; // This can be IdentityData or null
	} catch (jsonError) {
		// Handle cases where response is not JSON or structure is unexpected
		throw new Error(
			`Failed to parse Sigma API response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`,
		);
	}
};

/**
 * Registers the bap_getId tool for fetching a BAP identity.
 */
export function registerBapGetIdTool(
	server: McpServer,
	identityPk?: PrivateKey, // Accept the global identityPk
) {
	server.tool(
		"bap_getId",
		"Retrieves a Bitcoin Attestation Protocol (BAP) identity profile using an idKey (Paymail or public key). If no idKey is provided, it attempts to use the server's configured identity key.",
		{ args: bapGetIdArgsSchema },
		async (
			{ args }: { args: BapGetIdArgs },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		): Promise<CallToolResult> => {
			let targetIdKey = args.idKey;

			if (!targetIdKey) {
				// First priority: Use authenticated user's BAP ID from OAuth session
				const authInfo = (extra as any).authInfo;
				if (authInfo?.metadata?.bapId) {
					targetIdKey = authInfo.metadata.bapId;
					console.log(`Using authenticated user's BAP ID: ${targetIdKey}`);
				}
				// Second priority: Use authenticated user's pubkey
				else if (authInfo?.metadata?.pubkey) {
					targetIdKey = authInfo.metadata.pubkey;
					console.log(`Using authenticated user's pubkey: ${targetIdKey}`);
				}
				// Fallback: Attempt to get idKey from the passed identityPk or environment variable
				else {
					let pkToUse = identityPk;

					if (!pkToUse) {
						const identityKeyWifEnv = process.env.IDENTITY_KEY_WIF;
						if (identityKeyWifEnv) {
							try {
								pkToUse = PrivateKey.fromWif(identityKeyWifEnv);
							} catch (e) {
								// Don't error here, let it be handled by the final check
							}
						}
					}

					if (pkToUse) {
						// Sigma typically uses the public key string as the idKey
						targetIdKey = pkToUse.toPublicKey().toString();
					} else {
						return {
							content: [
								{
									type: "text",
									text: "idKey not provided and could not be derived from authenticated session or server configuration.",
								},
							],
							isError: true,
						};
					}
				}
			}

			if (!targetIdKey) {
				return {
					content: [
						{
							type: "text",
							text: "Critical error: targetIdKey is unexpectedly undefined after derivation attempts.",
						},
					],
					isError: true,
				};
			}

			try {
				const identityDataResult = await fetchProfile(targetIdKey);
				if (identityDataResult === null) {
					return {
						content: [
							{
								type: "text",
								text: `No BAP identity found for idKey: ${targetIdKey}`,
							},
						],
						isError: false, // Not an error, just no data found for the given key
					};
				}
				return {
					content: [
						{ type: "text", text: JSON.stringify(identityDataResult, null, 2) },
					],
				};
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				return {
					content: [
						{ type: "text", text: `Error fetching BAP ID: ${errorMessage}` },
					],
					isError: true,
				};
			}
		},
	);
}
