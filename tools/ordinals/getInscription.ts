import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

// Schema for get inscription arguments
export const getInscriptionArgsSchema = z.object({
	outpoint: z.string().describe("Outpoint in format 'txid_vout'"),
});

export type GetInscriptionArgs = z.infer<typeof getInscriptionArgsSchema>;

// Inscription API response type
interface InscriptionResponse {
	outpoint: string;
	origin: {
		outpoint: string;
		data?: {
			insc?: {
				text?: string;
				json?: unknown;
				file?: {
					hash?: string;
					size?: number;
					type?: string;
				};
			};
		};
	};
	height?: number;
	idx?: number;
	satoshis?: number;
	script?: string;
	spend?: string;
	[key: string]: unknown;
}

/**
 * Register the Ordinals inscription lookup tool
 */
export function registerGetInscriptionTool(server: McpServer): void {
	server.tool(
		"ordinals_getInscription",
		"Retrieves detailed information about a specific ordinal inscription by its outpoint. Returns complete inscription data including content type, file information, inscription origin, and current status. Useful for verifying NFT authenticity or retrieving metadata about digital artifacts.",
		{
			args: getInscriptionArgsSchema,
		},
		async (
			{ args }: { args: GetInscriptionArgs },
			extra: RequestHandlerExtra,
		) => {
			try {
				const { outpoint } = args;

				// Validate outpoint format
				if (!/^[0-9a-f]{64}_\d+$/i.test(outpoint)) {
					throw new Error("Invalid outpoint format. Expected 'txid_vout'");
				}

				// Fetch inscription data from GorillaPool API
				const response = await fetch(
					`https://ordinals.gorillapool.io/api/inscriptions/${outpoint}`,
				);

				if (response.status === 404) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({ error: "Inscription not found" }),
							},
						],
					};
				}

				if (!response.ok) {
					throw new Error(
						`API error: ${response.status} ${response.statusText}`,
					);
				}

				const data = (await response.json()) as InscriptionResponse;

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
