import type { OneSatServices } from "@1sat/client";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { errorToToolResult, successResult } from "../../utils/errors";

export function registerSearchInscriptionsTool(
	server: McpServer,
	services: OneSatServices,
): void {
	server.registerTool(
		"ordinals_searchInscriptions",
		{
			description:
				"Search indexed outputs by 1Sat event/topic/owner key (e.g. own:ADDRESS). Returns inscription and MAP metadata when indexed. This is an index-key search, not free-text search; use marketListings.q for listing names.",
			inputSchema: z.object({
				key: z
					.string()
					.trim()
					.min(1)
					.max(300)
					.describe("Index key, e.g. own:ADDRESS, ev:EVENT, or tp:TOPIC"),
				limit: z.number().int().min(1).max(100).default(20),
				from: z
					.number()
					.finite()
					.nonnegative()
					.optional()
					.describe("Last result's score for the next page"),
			}),
			annotations: {
				readOnlyHint: true,
				idempotentHint: true,
				openWorldHint: true,
			},
		},
		async ({ key, limit, from }) => {
			try {
				const results = await services.txo.search(key, {
					tags: ["insc", "origin", "map"],
					limit,
					from,
					rev: true,
					unspent: true,
				});
				const data = {
					results,
					nextFrom: results.length === limit ? results.at(-1)?.score : null,
				};
				return { ...successResult(data), structuredContent: data };
			} catch (error) {
				return errorToToolResult(error);
			}
		},
	);
}
