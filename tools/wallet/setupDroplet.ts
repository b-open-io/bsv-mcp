import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { DropletClient } from "../../utils/droplet";
import type { IntegratedWallet } from "./integratedWallet";

const setupDropletArgsSchema = z.object({
	action: z.enum(["register_key", "create_faucet", "check_status"]),
	faucetName: z.string().optional(),
	fixedDropSats: z.number().optional(),
});

export type SetupDropletArgs = z.infer<typeof setupDropletArgsSchema>;

/**
 * Register the setupDroplet tool for Droplet API initialization
 */
export function registerSetupDropletTool(
	server: McpServer,
	integratedWallet: IntegratedWallet,
) {
	server.tool(
		"wallet_setupDroplet",
		"Setup and manage Droplet API integration. Actions: register_key (registers your public key), create_faucet (creates a new faucet), check_status (checks faucet status)",
		{
			args: setupDropletArgsSchema,
		},
		async (
			{ args }: { args: SetupDropletArgs },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		) => {
			try {
				const dropletClient = integratedWallet.getDropletClient();
				if (!dropletClient) {
					throw new Error("Droplet client not configured");
				}

				const config = dropletClient.getConfig();
				const apiUrl = config.apiUrl;
				const authKey = config.authKey;

				switch (args.action) {
					case "register_key": {
						if (!authKey) {
							throw new Error("No auth key configured");
						}

						const pubkey = authKey.toPublicKey().toString();

						// Register the key with the Droplet API
						const response = await fetch(`${apiUrl}/auth/register`, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({ publicKey: pubkey }),
						});

						if (!response.ok) {
							const error = await response.text();
							throw new Error(`Failed to register key: ${error}`);
						}

						return {
							content: [
								{
									type: "text",
									text: JSON.stringify({
										status: "success",
										message: "Key registered successfully",
										publicKey: pubkey,
									}),
								},
							],
						};
					}

					case "create_faucet": {
						if (!args.faucetName) {
							throw new Error(
								"faucetName is required for create_faucet action",
							);
						}

						// First, ensure the key is registered
						if (authKey) {
							const pubkey = authKey.toPublicKey().toString();
							await fetch(`${apiUrl}/auth/register`, {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
								},
								body: JSON.stringify({ publicKey: pubkey }),
							});
						}

						// Create the faucet
						const body = {
							name: args.faucetName,
							fixed_drop_sats: args.fixedDropSats || 1000,
							max_consolidation_inputs: 20,
						};

						const headers = authKey
							? await dropletClient.getAuthHeaders("POST", "/faucets", body)
							: {};

						const response = await fetch(`${apiUrl}/faucets`, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								...headers,
							},
							body: JSON.stringify(body),
						});

						if (!response.ok) {
							const error = await response.text();
							throw new Error(`Failed to create faucet: ${error}`);
						}

						const result = await response.json();
						return {
							content: [
								{
									type: "text",
									text: JSON.stringify({
										status: "success",
										message: "Faucet created successfully",
										faucet: result,
									}),
								},
							],
						};
					}

					case "check_status": {
						const status = await dropletClient.getFaucetStatus();
						return {
							content: [
								{
									type: "text",
									text: JSON.stringify({
										status: "success",
										faucetStatus: status,
									}),
								},
							],
						};
					}

					default:
						throw new Error(`Unknown action: ${args.action}`);
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: error instanceof Error ? error.message : String(error),
						},
					],
					isError: true,
				};
			}
		},
	);
}
