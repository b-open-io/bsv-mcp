import type { OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Register the inscription search tool (stub — awaiting 1sat-stack implementation)
 */
export function registerSearchInscriptionsTool(
	server: McpServer,
	ctx?: OneSatContext,
): void {
	server.tool(
		"ordinals_searchInscriptions",
		"Search for inscriptions by various criteria. Currently awaiting 1sat-stack search API implementation.",
		{},
		async () => {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							error: "Inscription search API not yet available on 1sat-stack",
							status: "not_implemented",
						}),
					},
				],
				isError: true,
			};
		},
	);
}
