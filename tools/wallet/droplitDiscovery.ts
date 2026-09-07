import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	DroplitError,
	discoverDroplitSponsors,
	droplitApiBaseUrl,
} from "../../utils/droplit";
import { createSuccessResponse } from "../utils/errorHandler";

export function registerDroplitDiscoveryTool(
	server: McpServer,
	apiUrl: string,
) {
	const baseUrl = droplitApiBaseUrl(apiUrl);
	server.registerTool(
		"droplit_discover",
		{
			description:
				"List publicly opted-in sponsors. No wallet or sponsor selection is required. Listing grants no access or funding; choose a slug, then request the sponsor owner's approval separately.",
			inputSchema: {
				limit: z.number().int().min(1).max(50).optional(),
				after: z.string().optional(),
			},
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: true,
			},
		},
		async (options) => {
			try {
				const data = await discoverDroplitSponsors(baseUrl, options);
				return { ...createSuccessResponse(data), structuredContent: data };
			} catch (error) {
				const data = {
					error: error instanceof DroplitError ? error.code : "invalid_request",
					message:
						error instanceof DroplitError
							? error.message
							: "Invalid sponsor discovery request.",
				};
				return {
					...createSuccessResponse(data),
					structuredContent: data,
					isError: true,
				};
			}
		},
	);
}
