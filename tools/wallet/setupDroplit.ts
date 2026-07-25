import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../utils/errorHandler";
import type { IntegratedWallet } from "./integratedWallet";

/**
 * Droplit setup and faucet administration.
 *
 * These were one tool behind an `action` enum, which made every argument
 * conditional on the action and left the caller to work out which combination
 * was valid. They are three tools now, each declaring only what it needs.
 */

type DroplitClient = NonNullable<
	ReturnType<IntegratedWallet["getDroplitClient"]>
>;

/**
 * Every Droplit call needs a configured client and every write needs the
 * signing key, so resolve both up front rather than failing part-way through a
 * request with a different message depending on which tool was called.
 */
function requireDroplit(integratedWallet: IntegratedWallet): {
	apiUrl: string;
	publicKeyHex: string;
	client: DroplitClient;
} {
	const client = integratedWallet.getDroplitClient();
	if (!client) {
		throw new Error(
			"Droplit client is not configured. Set DROPLIT_API_URL and DROPLIT_FAUCET_NAME.",
		);
	}

	const { apiUrl, authKey } = client.getConfig();
	if (!authKey) {
		throw new Error(
			"Droplit requests must be signed, but no auth key is configured.",
		);
	}

	return { apiUrl, publicKeyHex: authKey.toPublicKey().toString(), client };
}

async function failIfNotOk(
	response: Response,
	attempted: string,
): Promise<void> {
	if (response.ok) return;
	throw new Error(
		`${attempted} failed (${response.status}): ${await response.text()}`,
	);
}

export function registerSetupDroplitTools(
	server: McpServer,
	integratedWallet: IntegratedWallet,
) {
	server.tool(
		"wallet_registerDroplitKey",
		"Registers this wallet's public key with the Droplit API so it can sign authenticated faucet requests. Run once before creating or operating a faucet.",
		{},
		async () => {
			try {
				const { apiUrl, publicKeyHex } = requireDroplit(integratedWallet);

				const response = await fetch(`${apiUrl}/auth/register`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ publicKey: publicKeyHex }),
				});
				await failIfNotOk(response, "Registering the Droplit key");

				return createSuccessResponse({
					message: "Public key registered with Droplit",
					publicKey: publicKeyHex,
				});
			} catch (error) {
				return createErrorResponse(error);
			}
		},
	);

	server.tool(
		"wallet_createDroplitFaucet",
		"Provisions a new Droplit faucet owned by this wallet. Register the wallet's public key first with wallet_registerDroplitKey.",
		{
			faucetName: z
				.string()
				.min(1)
				.describe("Identifier for the new faucet; must be unique"),
			fixedDropSats: z
				.number()
				.int()
				.positive()
				.optional()
				.describe(
					"Satoshis paid out per tap. Server default applies if unset.",
				),
			maxConsolidationInputs: z
				.number()
				.int()
				.positive()
				.optional()
				.describe("Cap on inputs the faucet consolidates in one transaction"),
		},
		async ({ faucetName, fixedDropSats, maxConsolidationInputs }) => {
			try {
				const { client } = requireDroplit(integratedWallet);

				// Ownership comes from the BRC-103/104 identity established by the
				// handshake, not from the body, so the key is never sent here.
				const body = {
					name: faucetName,
					...(fixedDropSats !== undefined && {
						fixed_drop_sats: fixedDropSats,
					}),
					...(maxConsolidationInputs !== undefined && {
						max_consolidation_inputs: maxConsolidationInputs,
					}),
				};

				const response = await client.authenticatedFetch("/faucets", {
					method: "POST",
					body,
				});
				await failIfNotOk(response, "Creating the Droplit faucet");

				return createSuccessResponse({
					message: "Faucet created",
					faucet: await response.json(),
				});
			} catch (error) {
				return createErrorResponse(error);
			}
		},
	);

	server.tool(
		"wallet_checkDroplitFaucetStatus",
		"Reads the status of the configured Droplit faucet, including balance and payout settings.",
		{},
		async () => {
			try {
				const { client } = requireDroplit(integratedWallet);
				return createSuccessResponse({
					faucetStatus: await client.getFaucetStatus(),
				});
			} catch (error) {
				return createErrorResponse(error);
			}
		},
	);
}
