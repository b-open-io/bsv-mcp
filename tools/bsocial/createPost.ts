import { Utils } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { B_PREFIX, MAP_PREFIX } from "../constants";
import { signOpReturnWithAIP } from "../utils/aip";
import { createResponse, formatError } from "../utils/errorHandler";
import {
	buildAndSendTransaction,
	buildOpReturnScript,
} from "../utils/transactionBuilder";
import type { Wallet } from "../wallet/wallet";

const { toArray } = Utils;

// Schema for creating a social post
const createPostArgsSchema = z.object({
	content: z.string().describe("The content of the post"),
	contentType: z
		.enum(["text/plain", "text/markdown"])
		.default("text/plain")
		.describe("Content type of the post"),
	app: z
		.string()
		.default("bsv-mcp")
		.describe("Application name creating the post"),
	additionalMapData: z
		.record(z.string())
		.optional()
		.describe("Additional MAP protocol key-value pairs"),
});

type CreatePostArgs = z.infer<typeof createPostArgsSchema>;

/**
 * Create a social post on the BSV blockchain using B:// and MAP protocols
 */
export async function createSocialPost(
	args: CreatePostArgs,
	wallet: Wallet,
): Promise<{
	success: boolean;
	txid?: string;
	rawTx?: string;
	error?: string;
}> {
	try {
		const { content, contentType, app, additionalMapData } = args;

		// Get wallet info
		const address = await wallet.getAddress();
		const paymentKey = wallet.getPaymentKey();
		if (!paymentKey) {
			return {
				success: false,
				error: "Payment key not available in wallet",
			};
		}

		// Prepare file extension based on content type
		const fileExtension = contentType === "text/markdown" ? "md" : "txt";
		const fileName = `post.${fileExtension}`;

		// Build B protocol data
		const bData = [
			toArray(B_PREFIX, "utf8"),
			toArray(content, "utf8"),
			toArray(contentType, "utf8"),
			toArray("utf-8", "utf8"),
			toArray(fileName, "utf8"),
		];

		// Build MAP protocol data
		const mapData: Uint8Array[] = [
			toArray(MAP_PREFIX, "utf8"),
			toArray("SET", "utf8"),
			toArray("app", "utf8"),
			toArray(app, "utf8"),
			toArray("type", "utf8"),
			toArray("post", "utf8"),
		];

		// Add any additional MAP data
		if (additionalMapData) {
			for (const [key, value] of Object.entries(additionalMapData)) {
				mapData.push(toArray(key, "utf8"), toArray(value, "utf8"));
			}
		}

		// Combine protocols with pipe separator
		const pipeData = toArray("|", "utf8");
		const dataToSign = [...bData, pipeData, ...mapData];

		// Sign the data with AIP
		const { signedData } = await signOpReturnWithAIP(
			dataToSign,
			paymentKey,
			address.toString(),
		);

		// Create OP_RETURN script
		const script = buildOpReturnScript(signedData);

		// Get UTXOs
		const utxos = await wallet.getPaymentUtxos();

		// Build and send transaction using the new utility
		return await buildAndSendTransaction({
			outputs: [{ script, satoshis: 0 }],
			utxos,
			changeAddress: address.toString(),
			paymentKey,
		});
	} catch (error) {
		console.error("Error creating social post:", formatError(error));
		return {
			success: false,
			error: formatError(error),
		};
	}
}

/**
 * Register the social post tool with the MCP server
 */
export function registerCreatePostTool(server: McpServer, wallet: Wallet) {
	server.tool(
		"bsocial_createPost",
		"Create a social post on the BSV blockchain using B:// and MAP protocols. Posts are stored permanently on-chain and can include plain text or markdown content.",
		{ args: createPostArgsSchema },
		async ({ args }: { args: CreatePostArgs }): Promise<CallToolResult> => {
			const result = await createSocialPost(args, wallet);
			return createResponse(result);
		},
	);
}
