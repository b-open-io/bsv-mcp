import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

// Schema for get token by ID or ticker arguments
export const getTokenByIdOrTickerArgsSchema = z
	.object({
		id: z
			.string()
			.optional()
			.describe("BSV20 token ID in outpoint format (txid_vout)"),
		tick: z.string().optional().describe("BSV20 token ticker symbol"),
	})
	.refine((data) => data.id || data.tick, {
		message: "Either id or tick must be provided",
	});

export type GetTokenByIdOrTickerArgs = z.infer<
	typeof getTokenByIdOrTickerArgsSchema
>;

// BSV20 token response type
interface TokenResponse {
	id: string;
	tick?: string;
	sym?: string;
	max?: string;
	lim?: string;
	dec?: number;
	supply?: string;
	amt?: string;
	status?: number;
	icon?: string;
	height?: number;
	[key: string]: unknown;
}

/**
 * Register the BSV20 token lookup tool
 */
export function registerGetTokenByIdOrTickerTool(server: McpServer): void {
	server.tool(
		"ordinals_getTokenByIdOrTicker",
		"Retrieves detailed information about a specific BSV-20 token by its ID or ticker symbol. Returns complete token data including ticker symbol, supply information, decimals, and current status. This tool is useful for verifying token authenticity or checking supply metrics.",
		{
			args: getTokenByIdOrTickerArgsSchema,
		},
		async (
			{ args }: { args: GetTokenByIdOrTickerArgs },
			extra: RequestHandlerExtra,
		) => {
			try {
				const { id, tick } = args;

				// Validate that at least one of id or tick is provided
				if (!id && !tick) {
					throw new Error("Either token ID or ticker symbol must be provided");
				}

				// Validate ID format if provided
				if (id && !/^[0-9a-f]{64}_\d+$/i.test(id)) {
					throw new Error("Invalid BSV20 ID format. Expected 'txid_vout'");
				}

				// Determine which endpoint to use based on provided parameters
				let endpoint: string;
				if (id) {
					endpoint = `https://ordinals.gorillapool.io/api/bsv20/id/${id}`;
				} else {
					endpoint = `https://ordinals.gorillapool.io/api/bsv20/tick/${tick}`;
				}

				// Fetch BSV20 token data from GorillaPool API
				const response = await fetch(endpoint);

				if (response.status === 404) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({ error: "BSV20 token not found" }),
							},
						],
					};
				}

				if (!response.ok) {
					throw new Error(
						`API error: ${response.status} ${response.statusText}`,
					);
				}

				const data = (await response.json()) as TokenResponse;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(data, null, 2),
						},
					],
				};
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
