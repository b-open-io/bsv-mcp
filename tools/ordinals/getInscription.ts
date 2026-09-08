import type { OneSatServices } from "@1sat/client";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

/**
 * Register the inscription metadata lookup tool
 */
export function registerGetInscriptionTool(
	server: McpServer,
	services: OneSatServices,
): void {
	server.registerTool(
		"ordinals_getInscription",
		{
			description:
				"Retrieves metadata for an inscription by its outpoint. Returns content type, file info, origin, MAP data, and sequence info.",
			inputSchema: z.object({
				outpoint: z
					.string()
					.describe("Outpoint in format 'txid.vout' or 'txid_vout'"),
			}),
		},
		async ({ outpoint }) => {
			try {
				if (!services) {
					throw new Error("OneSat services not available");
				}

				if (!/^[0-9a-f]{64}[._]\d+$/i.test(outpoint)) {
					throw new Error(
						"Invalid outpoint format. Expected 'txid.vout' or 'txid_vout'",
					);
				}

				const data = await services.ordfs.getMetadata(
					outpoint.replace("_", "."),
				);

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
