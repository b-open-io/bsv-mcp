import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { readServices } from "../../utils/backends";
import { errorToToolResult, successResult } from "../../utils/errors";
import { X402Client } from "../../utils/x402";
import type { ToolsConfig } from "../index";

function serviceHeaders() {
	try {
		return z
			.record(z.string().url(), z.record(z.string(), z.string()))
			.parse(JSON.parse(process.env.X402_SERVICE_HEADERS ?? "{}"));
	} catch {
		throw new Error(
			"X402_SERVICE_HEADERS must be a JSON object mapping HTTPS origins to header objects",
		);
	}
}

export function registerX402Tools(server: McpServer, config: ToolsConfig) {
	const paymentWallet =
		config.enableWalletTools === false ||
		process.env.DISABLE_WALLET_TOOLS === "true"
			? undefined
			: config.ctx?.wallet;
	const broadcastingDisabled =
		config.disableBroadcasting === true ||
		process.env.DISABLE_BROADCASTING === "true";
	let client: X402Client | undefined;
	const getClient = () =>
		(client ??= new X402Client({
			wallet: paymentWallet,
			disabled: broadcastingDisabled,
			serviceHeaders: serviceHeaders(),
			getBeef: (txid) =>
				readServices(config.ctx?.services ?? config.services).beef.getBeef(
					txid,
				),
		}));
	const run = async (fn: () => Promise<unknown>) => {
		try {
			const data = (await fn()) as Record<string, unknown>;
			return {
				...successResult(data),
				structuredContent: data,
				...(["outcome_unknown", "not_submitted"].includes(
					String(data.status),
				) || Number(data.httpStatus) >= 400
					? { isError: true }
					: {}),
			};
		} catch (error) {
			return errorToToolResult(error);
		}
	};
	server.registerTool(
		"x402_request",
		{
			description:
				"Request any HTTPS service without automatically paying. Returns the response if free, or a BSV payment quote for approval. POST/PUT/PATCH/DELETE may execute if the service does not require payment. Use auth=brc31 for BSV-authenticated/BRC-105 services. No API key required by the client; optional service credentials are scoped by X402_SERVICE_HEADERS. Supports BRC-105, bound BRC-120 with OP_TRUE nonces, and compact bsv-tx-v1 challenges.",
			inputSchema: z.object({
				url: z.string().url(),
				method: z
					.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
					.default("GET"),
				body: z.string().max(1398104).optional(),
				bodyEncoding: z.enum(["utf8", "base64"]).default("utf8"),
				headers: z.record(z.string(), z.string()).optional(),
				auth: z.enum(["none", "brc31"]).default("none"),
				boundHeaders: z
					.array(z.string())
					.optional()
					.describe(
						"BRC-120 header names bound by the service; defaults to supplied request headers",
					),
			}),
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: true,
			},
		},
		(args) => run(() => getClient().request(args)),
	);
	if (paymentWallet && !broadcastingDisabled) {
		server.registerTool(
			"x402_payQuote",
			{
				description:
					"Pay a previously quoted BSV service request from the connected wallet, then return its response. Only call after authorization for the service, amount, and total limit including mining fees. Reuses the stored URL, method, body and credentials. Wallet permission checks apply. Does not automatically pay changed terms or retry a failed payment.",
				inputSchema: z.object({
					quoteId: z.string().uuid(),
					maxTotalSats: z.number().int().positive().max(2_100_000_000_000_000),
				}),
				annotations: {
					readOnlyHint: false,
					destructiveHint: true,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			({ quoteId, maxTotalSats }) =>
				run(() => getClient().pay(quoteId, maxTotalSats)),
		);
	}
}
