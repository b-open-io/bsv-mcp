import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

// Schema for get BSV20 by ID arguments
export const getBsv20ByIdArgsSchema = z.object({
	id: z.string().describe("BSV20 token ID in outpoint format (txid_vout)"),
});

export type GetBsv20ByIdArgs = z.infer<typeof getBsv20ByIdArgsSchema>;

// BSV20 token response type
interface Bsv20TokenResponse {
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
export function registerGetBsv20ByIdTool(server: McpServer): void {
	server.tool(
		"ordinals_getBsv20ById",
		{
			args: getBsv20ByIdArgsSchema,
		},
		async (
			{ args }: { args: GetBsv20ByIdArgs },
			extra: RequestHandlerExtra,
		) => {
			try {
				const { id } = args;

				// Validate ID format (should be in outpoint format)
				if (!/^[0-9a-f]{64}_\d+$/i.test(id)) {
					throw new Error("Invalid BSV20 ID format. Expected 'txid_vout'");
				}

				// Fetch BSV20 token data from GorillaPool API
				const response = await fetch(
					`https://ordinals.gorillapool.io/api/bsv20/id/${id}`,
				);

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

				const data = (await response.json()) as Bsv20TokenResponse;

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
