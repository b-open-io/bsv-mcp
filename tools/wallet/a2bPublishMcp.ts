import { PrivateKey, Utils } from "@bsv/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ClientNotification,
	ClientRequest,
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { createOrdinals } from "js-1sat-ord";
import type {
	ChangeResult,
	CreateOrdinalsConfig,
	Destination,
	Inscription,
	LocalSigner,
	PreMAP,
} from "js-1sat-ord";
import { Sigma } from "sigma-protocol";
import { z } from "zod";
import type { Wallet } from "./wallet";
const { toArray, toBase64 } = Utils;

// API endpoint for the A2B Overlay service
const OVERLAY_API_URL = "https://a2b-overlay-production.up.railway.app/v1";

// Schema for the MCP tool configuration
export const McpConfigSchema = z.object({
	command: z.string().describe("The command to execute the tool"),
	args: z.array(z.string()).describe("Arguments to pass to the command"),
	tools: z.array(z.string()).optional().describe("Available tool names"),
	prompts: z.array(z.string()).optional().describe("Available prompt names"),
	resources: z.array(z.string()).optional().describe("Available resource URIs"),
	env: z.record(z.string()).optional().describe("Environment variables"),
});

export type McpConfig = z.infer<typeof McpConfigSchema>;

// Schema for on-chain tool publish parameters
export const a2bPublishMcpArgsSchema = z.object({
	toolName: z.string().describe("Human-friendly tool name"),
	command: z.string().describe("The command to execute the tool"),
	args: z.array(z.string()).describe("Arguments to pass to the command"),
	keywords: z
		.array(z.string())
		.optional()
		.describe("Optional keywords to improve tool discoverability"),
	env: z
		.array(
			z.object({
				key: z.string().describe("Environment variable name"),
				description: z
					.string()
					.describe("Description of the environment variable"),
			}),
		)
		.optional()
		.describe("Optional environment variables with descriptions"),
	description: z.string().optional().describe("Optional tool description"),
	destinationAddress: z
		.string()
		.optional()
		.describe("Optional target address for inscription"),
});

export type A2bPublishMcpArgs = z.infer<typeof a2bPublishMcpArgsSchema>;

/**
 * Call the ingest endpoint to process a transaction
 */
async function callIngestEndpoint(txid: string): Promise<boolean> {
	try {
		const response = await fetch(`${OVERLAY_API_URL}/ingest`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ txid }),
		});

		if (!response.ok) {
			console.warn(
				`Ingest API returned status ${response.status}: ${response.statusText}`,
			);
			return false;
		}

		const result = await response.json();
		// console.log('Ingest result:', result);
		return true;
	} catch (error) {
		console.warn("Error calling ingest endpoint:", error);
		return false;
	}
}

/**
 * Fetches MCP metadata (tools, prompts, resources) by running the command
 * and connecting to it via the MCP client
 */
async function fetchMcpMetadata(
	command: string,
	args: string[],
): Promise<{
	tools: string[];
	prompts: string[];
	resources: string[];
}> {
	// console.log(`Fetching MCP metadata by running: ${command} ${args.join(' ')}`);

	let transport: StdioClientTransport | undefined;
	let client:
		| Client<
				ClientRequest,
				ServerRequest,
				ClientNotification | ServerNotification
		  >
		| undefined;

	try {
		// Create a transport to the MCP server
		// Pass through all current environment variables to ensure the same configuration
		transport = new StdioClientTransport({
			command,
			args,
			env: {
				...process.env, // Pass through all current environment variables
				DISABLE_BROADCASTING: "true", // Prevent actual broadcasting during tool discovery
			},
		});

		// Create and connect a client
		client = new Client({
			name: "metadata-fetcher",
			version: "1.0.0",
		});

		await client.connect(transport);

		// Fetch available tools, prompts, and resources
		const toolsResponse = await client.listTools();
		const promptsResponse = await client.listPrompts();
		const resourcesResponse = await client.listResources();

		// Extract the names/URIs
		const tools = toolsResponse.tools.map((tool) => tool.name);
		const prompts = promptsResponse.prompts.map((prompt) => prompt.name);
		const resources = resourcesResponse.resources.map(
			(resource) => resource.uri,
		);

		// Add known tools that might be missing, avoid duplicates
		const allTools = [...new Set([...tools])];

		return {
			tools: allTools,
			prompts,
			resources,
		};
	} catch (error) {
		console.error("Error fetching MCP metadata:", error);
		// Return hardcoded list of known tools if fetching fails
		return {
			tools: [],
			prompts: [],
			resources: [],
		};
	} finally {
		// Clean up resources
		if (transport) {
			try {
				// Close the transport to shut down the child process
				await transport.close();
			} catch (e) {
				console.error("Error closing transport:", e);
			}
		}
	}
}

/**
 * Registers the wallet_a2bPublishMcp for publishing an MCP tool configuration on-chain
 */
export function registerA2bPublishMcpTool(
	server: McpServer,
	wallet: Wallet,
	config: { disableBroadcasting: boolean },
) {
	server.tool(
		"wallet_a2bPublishMcp",
		"Publish an MCP tool configuration record on-chain via Ordinal inscription. This creates a permanent, immutable, and discoverable tool definition that can be accessed by other MCP servers. The tool is published as a JSON inscription with metadata and optional digital signatures for authenticity verification.",
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

				// Fetch MCP metadata (tools, prompts, resources)
				const metadata = await fetchMcpMetadata(args.command, args.args);
				// console.log(`Discovered ${metadata.tools.length} tools, ${metadata.prompts.length} prompts, and ${metadata.resources.length} resources`);

				// Assemble tool configuration
				const toolConfig: McpConfig = {
					command: args.command,
					args: args.args,
					tools: metadata.tools,
					prompts: metadata.prompts,
					resources: metadata.resources,
					env: args.env
						? args.env.reduce(
								(acc, { key, description }) => {
									acc[key] = description;
									return acc;
								},
								{} as Record<string, string>,
							)
						: undefined,
				};

				// Validate compliance
				McpConfigSchema.parse(toolConfig);

				// Prepare the full configuration with metadata
				const fullConfig = {
					mcpServers: {
						[args.toolName]: {
							description: args.description || "",
							keywords: args.keywords || [],
							tools: metadata.tools || [],
							prompts: metadata.prompts || [],
							resources: metadata.resources || [],
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

				const createOrdinalsConfig = {
					utxos: paymentUtxos,
					destinations,
					paymentPk,
					changeAddress: walletAddress,
					metaData,
				} as CreateOrdinalsConfig;
				if (identityPk) {
					createOrdinalsConfig.signer = {
						idKey: identityPk,
					} as LocalSigner;
				}
				// Inscribe the ordinal on-chain via js-1sat-ord
				const result = await createOrdinals(createOrdinalsConfig);

				const changeResult = result as ChangeResult;

				// Broadcast the transaction
				if (!config.disableBroadcasting) {
					await changeResult.tx.broadcast();
					const txid = changeResult.tx.id("hex");

					setTimeout(async () => {
						// Call the ingest endpoint to process the transaction
						await callIngestEndpoint(txid);
					}, 1000);

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
					const outpoint = `${txid}_${outpointIndex}`;

					// Tool URL for discovery is the outpoint
					const onchainUrl = `ord://${outpoint}`;

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										status: "success",
										txid,
										outpoint,
										onchainUrl,
										toolName: args.toolName,
										toolCount: metadata.tools.length,
										promptCount: metadata.prompts.length,
										resourceCount: metadata.resources.length,
										description:
											args.description || `MCP Tool: ${args.toolName}`,
										address: targetAddress,
									},
									null,
									2,
								),
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text",
							text: changeResult.tx.toHex(),
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
