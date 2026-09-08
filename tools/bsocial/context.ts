import { createSocialPost, type OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { assertBroadcastAllowed } from "../../utils/broadcastGuard";

export function registerContextSocialPost(
	server: McpServer,
	ctx: OneSatContext,
	disableBroadcasting = false,
) {
	server.registerTool(
		"bsocial_createPost",
		{
			description:
				"Publish a BSocial post with an AIP signature from the selected BAP identity wallet. Requires a published identity. The identity wallet funds the transaction; content becomes public on chain.",
			inputSchema: z.strictObject({
				content: z.string().min(1).max(100_000),
				contentType: z
					.enum(["text/plain", "text/markdown"])
					.default("text/plain"),
				app: z.string().min(1).max(100).default("bsv-mcp"),
				tags: z.array(z.string().max(100)).max(50).optional(),
			}),
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: true,
			},
		},
		async (input) => {
			try {
				assertBroadcastAllowed("bsocial_createPost", disableBroadcasting);
				const result = await createSocialPost.execute(ctx, input);
				return {
					content: [{ type: "text", text: JSON.stringify(result) }],
					...(result.error ? { isError: true } : {}),
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
