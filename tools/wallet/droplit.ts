import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { assertBroadcastAllowed } from "../../utils/broadcastGuard";
import { type DroplitClient, DroplitError } from "../../utils/droplit";
import { createSuccessResponse } from "../utils/errorHandler";

function errorResult(error: unknown) {
	const failure =
		error instanceof DroplitError
			? error
			: new DroplitError(
					"request_failed",
					"Droplit operation failed. Check configuration and broadcasting policy.",
				);
	const data = {
		error: failure.code,
		message: failure.message,
		...(failure.status === undefined ? {} : { status: failure.status }),
		...failure.details,
	};
	return {
		...createSuccessResponse(data),
		structuredContent: data,
		isError: true,
	};
}

export function registerDroplitTools(
	server: McpServer,
	client: DroplitClient,
	disableBroadcasting = false,
) {
	server.registerTool(
		"droplit_getAccess",
		{
			description:
				"Read this connected wallet's sponsor authorization and quotas. If unauthorized, a human sponsor owner must approve the wallet manually. Does not create, fund, or approve anything.",
			inputSchema: {},
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: true,
			},
		},
		async () => {
			try {
				const access = await client.getAccess();
				const data = {
					...access,
					...(!access.authorized
						? {
								error: "approval_required",
								message:
									"Ask the sponsor owner to approve this wallet. Copy the approval URL for manual review; do not auto-open or submit approval.",
								approval_url: `https://droplit.dev${access.approval_path}`,
							}
						: {}),
				};
				return {
					...createSuccessResponse(data),
					structuredContent: data,
					isError: !access.authorized,
				};
			} catch (error) {
				return errorResult(error);
			}
		},
	);
	server.registerTool(
		"droplit_push",
		{
			description:
				"Submit one sponsored data transaction. Subject to sponsor approval and quotas. An unknown outcome requires checking transaction history before retrying.",
			inputSchema: {
				data: z.array(z.string()).min(1),
				encoding: z.enum(["hex", "utf8"]),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: true,
			},
		},
		async ({ data, encoding }) => {
			try {
				if (disableBroadcasting) throw new Error("Broadcasting disabled");
				assertBroadcastAllowed("droplit_push");
				return createSuccessResponse(await client.push(data, encoding));
			} catch (error) {
				return errorResult(error);
			}
		},
	);
	server.registerTool(
		"droplit_fund",
		{
			description:
				"Submit one raw transaction for sponsor funding and broadcast. Subject to sponsor approval and quotas. Unknown outcomes must be reconciled before retrying.",
			inputSchema: {
				rawtx: z
					.string()
					.min(2)
					.regex(/^(?:[0-9a-fA-F]{2})+$/, "Expected raw transaction hex"),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: true,
			},
		},
		async ({ rawtx }) => {
			try {
				if (disableBroadcasting) throw new Error("Broadcasting disabled");
				assertBroadcastAllowed("droplit_fund");
				return createSuccessResponse(await client.fund(rawtx));
			} catch (error) {
				return errorResult(error);
			}
		},
	);
}
