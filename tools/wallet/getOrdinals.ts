import { listOrdinals, type OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerGetOrdinalsTool(
	server: McpServer,
	ctx?: OneSatContext,
) {
	server.tool(
		"wallet_getOrdinals",
		"List ordinals/inscriptions in the wallet with metadata. Each result carries an 'id:' tag; that tracking id is the handle the transfer, listing and cancel tools take.",
		{
			limit: z
				.number()
				.int()
				.optional()
				.describe("Max number of results to return"),
			offset: z.number().int().optional().describe("Number of results to skip"),
			tags: z
				.array(z.string())
				.optional()
				.describe("Filter by output tags (e.g. 'type:image/png')"),
			tagQueryMode: z
				.enum(["all", "any"])
				.optional()
				.describe("Whether results must match all tags or any tag"),
		},
		async (params) => {
			try {
				if (!ctx) throw new Error("BRC-100 wallet context not available");
				const result = await listOrdinals.execute(ctx, params);
				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				};
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);
}
