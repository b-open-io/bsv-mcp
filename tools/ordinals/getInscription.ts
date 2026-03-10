import type { OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register the inscription metadata lookup tool
 */
export function registerGetInscriptionTool(
	server: McpServer,
	ctx?: OneSatContext,
): void {
	server.tool(
		"ordinals_getInscription",
		"Retrieves metadata for an inscription by its outpoint. Returns content type, file info, origin, MAP data, and sequence info.",
		{
			outpoint: z
				.string()
				.describe("Outpoint in format 'txid_vout'"),
		},
		async ({ outpoint }) => {
			try {
				if (!ctx?.services) {
					throw new Error("OneSat services not available");
				}

				if (!/^[0-9a-f]{64}_\d+$/i.test(outpoint)) {
					throw new Error("Invalid outpoint format. Expected 'txid_vout'");
				}

				const data = await ctx.services.ordfs.getMetadata(outpoint);

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
