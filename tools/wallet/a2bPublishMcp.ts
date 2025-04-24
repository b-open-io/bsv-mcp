import { PrivateKey, Utils } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { createOrdinals } from "js-1sat-ord";
import type {
	ChangeResult,
	Destination,
	Inscription,
	PreMAP,
} from "js-1sat-ord";
import { Sigma } from "sigma-protocol";
import { z } from "zod";
import type { Wallet } from "./wallet";
const { toArray, toBase64 } = Utils;

// Schema for the MCP tool configuration
export const McpConfigSchema = z.object({
	command: z.string().describe("The command to execute the tool"),
	args: z.array(z.string()).describe("Arguments to pass to the command"),
	env: z.record(z.string()).optional().describe("Environment variables"),
});

export type McpConfig = z.infer<typeof McpConfigSchema>;

// Schema for on-chain tool publish parameters
export const a2bPublishMcpArgsSchema = z.object({
	toolName: z.string().describe("Human-friendly tool name"),
	command: z.string().describe("The command to execute the tool"),
	args: z.array(z.string()).describe("Arguments to pass to the command"),
	env: z
		.record(z.string())
		.optional()
		.describe("Optional environment variables"),
	description: z.string().optional().describe("Optional tool description"),
	destinationAddress: z
		.string()
		.optional()
		.describe("Optional target address for inscription"),
});

export type A2bPublishMcpArgs = z.infer<typeof a2bPublishMcpArgsSchema>;

/**
 * Registers the wallet_a2bPublishMcp for publishing an MCP tool configuration on-chain
 */
export function registerA2bPublishMcpTool(server: McpServer, wallet: Wallet) {
	server.tool(
		"wallet_a2bPublishMcp",
		"Publish an MCP tool configuration record on-chain via Ordinal inscription",
		{ args: a2bPublishMcpArgsSchema },
		async (
			{ args }: { args: A2bPublishMcpArgs },
			extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		) => {
			try {
				// Load optional identity key for sigma signing
				const identityKeyWif = process.env.IDENTITY_KEY_WIF;
				let identityPk: PrivateKey | undefined;
				if (identityKeyWif) {
					try {
						identityPk = PrivateKey.fromWif(identityKeyWif);
					} catch (e) {
						console.warn(
							"Warning: Invalid IDENTITY_KEY_WIF environment variable; sigma signing disabled",
							e,
						);
					}
				}

				const paymentPk = wallet.getPrivateKey();
				if (!paymentPk) throw new Error("No private key available");

				const { paymentUtxos } = await wallet.getUtxos();
				if (!paymentUtxos?.length)
					throw new Error("No payment UTXOs available to fund inscription");

				const walletAddress = paymentPk.toAddress().toString();

				// Assemble tool configuration
				const toolConfig: McpConfig = {
					command: args.command,
					args: args.args,
					env: args.env,
				};

				// Validate compliance
				McpConfigSchema.parse(toolConfig);

				// Prepare the full configuration with metadata
				const fullConfig = {
					mcpServers: {
						[args.toolName]: {
							description: args.description || `MCP Tool: ${args.toolName}`,
							type: "mcp-tool",
							...toolConfig,
						},
					},
				};

				const fileContent = JSON.stringify(fullConfig, null, 2);

				// Base64 payload for inscription
				const dataB64 = toBase64(toArray(fileContent));
				const inscription: Inscription = {
					dataB64,
					contentType: "application/json",
				};

				// Destination for the ordinal
				const targetAddress = args.destinationAddress ?? walletAddress;
				const destinations: Destination[] = [
					{ address: targetAddress, inscription },
				];

				// Default MAP metadata: file path, content type, encoding
				const metaData: PreMAP = { app: "bsv-mcp", type: "a2b-mcp" };

				// Inscribe the ordinal on-chain via js-1sat-ord
				const result = await createOrdinals({
					utxos: paymentUtxos,
					destinations,
					paymentPk,
					changeAddress: walletAddress,
					metaData,
				});

				const changeResult = result as ChangeResult;

				let finalTx = changeResult.tx;
				if (identityPk) {
					const sigma = new Sigma(result.tx);
					const signResponse = sigma.sign(identityPk);
					finalTx = signResponse.signedTx;
				}
				// Broadcast the transaction
				await finalTx.broadcast();

				// Refresh UTXOs after spending
				try {
					await wallet.refreshUtxos();
				} catch (refreshError) {
					console.warn(
						"Failed to refresh UTXOs after transaction:",
						refreshError,
					);
				}

				// Build a nicely formatted result
				const outpointIndex = 0; // First output with the inscription
				const outpoint = `${changeResult.tx.id("hex")}_${outpointIndex}`;

				// Tool URL for discovery is the outpoint
				const onchainUrl = `ord://${outpoint}`;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									status: "success",
									txid: changeResult.tx.id("hex"),
									outpoint,
									onchainUrl,
									toolName: args.toolName,
									description: args.description || `MCP Tool: ${args.toolName}`,
									address: targetAddress,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);
}
