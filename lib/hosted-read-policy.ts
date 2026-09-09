import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { registerSocialReadTool } from "../tools/bsocial/read";
import { registerBsvTools } from "../tools/bsv";
import { registerStatusTool } from "../tools/bsv/status";
import { registerOrdinalsTools } from "../tools/ordinals";
import { convertData } from "../tools/utils/conversion";
import { registerFindSkillsTool } from "../tools/utils/findSkills";

/**
 * Hosted read-only boundary for the Next.js MCP route.
 *
 * This is the allowlist counterpart to the modern-era policy: it is enforced
 * for every protocol era on the hosted route, so a future tool registration
 * cannot silently become callable there. The list contains only reviewed
 * public reads (BSV reads/status, Ordinals reads, public BSocial/BMAP reads,
 * utility read helpers, and the compact read families). Wallet, account, BAP
 * identity, MNEE, x402, and every other private or mutating capability are
 * absent by construction.
 *
 * This module never reads or parses key material (`PRIVATE_KEY_WIF`,
 * `IDENTITY_KEY_WIF`, or any equivalent). Registration takes no wallet,
 * account, or signer configuration, so the hosted boundary holds
 * independently of `DISABLE_BROADCASTING` and any inherited environment.
 */
export const HOSTED_READ_TOOL_ALLOWLIST: readonly string[] = Object.freeze([
	"bsv_getPrice",
	"bsv_decodeTransaction",
	"bsv_explore",
	"bsv_status",
	"ordinals_getInscription",
	"ordinals_searchInscriptions",
	"ordinals_marketListings",
	"ordinals_marketSales",
	"ordinals_getTokenByIdOrTicker",
	"bsocial_read",
	"utils_convertData",
	"utils_find_skills",
	"bsv_read",
	"ordinals_read",
	"utility",
]);

const hostedReadToolNames = new Set(HOSTED_READ_TOOL_ALLOWLIST);

/** Return whether a tool is in the reviewed hosted read-only surface. */
export function isHostedReadTool(name: string): boolean {
	return hostedReadToolNames.has(name);
}

/** Stable denial returned before a non-read tool callback is entered. */
export function hostedToolDeniedResult(name: string): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text: `Tool ${name} is unavailable on the hosted read-only MCP endpoint.`,
			},
		],
		isError: true,
	};
}

type ToolCallbackFunction = (...args: never[]) => unknown;

function isToolCallback(value: unknown): value is ToolCallbackFunction {
	return typeof value === "function";
}

/**
 * Install the hosted read-only policy before any tool registrations take
 * place. Unlike the modern-era policy this applies to every era, so legacy
 * protocol requests cannot reach a mutating tool either. Registrations for
 * tools outside the allowlist keep their name but resolve to a stable denial
 * whose business callback is never entered.
 */
export function withHostedReadPolicy(server: McpServer): McpServer {
	return new Proxy(server, {
		get(target, property, receiver) {
			if (property !== "registerTool") {
				return Reflect.get(target, property, receiver);
			}

			return (...args: unknown[]) => {
				const [name, config, callback] = args;
				if (typeof name !== "string" || !isToolCallback(callback)) {
					return Reflect.apply(target.registerTool, target, args);
				}
				if (isHostedReadTool(name)) {
					return Reflect.apply(target.registerTool, target, args);
				}
				return Reflect.apply(target.registerTool, target, [
					name,
					config,
					() => hostedToolDeniedResult(name),
				]);
			};
		},
	});
}

const convertDataSchema = z.object({
	data: z.string().describe("The data string to be converted"),
	from: z
		.enum(["utf8", "hex", "base64", "binary"])
		.describe("Source encoding format (utf8, hex, base64, or binary)"),
	to: z
		.enum(["utf8", "hex", "base64", "binary"])
		.describe(
			"Target encoding format to convert to (utf8, hex, base64, or binary)",
		),
});

/**
 * Register exactly the reviewed hosted public reads. Takes no keys, wallet,
 * account, or signer configuration; public BSocial/BMAP reads are registered
 * individually so post-writing tools cannot be pulled in, and only the
 * read-only utility helpers are registered (never install/droplet or other
 * mutating utilities).
 */
export function registerHostedReadTools(server: McpServer): void {
	registerBsvTools(server);
	registerStatusTool(server, {});
	registerOrdinalsTools(server);
	registerSocialReadTool(server);
	server.registerTool(
		"utils_convertData",
		{
			description:
				"Converts data between different encodings (utf8, hex, base64, binary).",
			inputSchema: convertDataSchema,
		},
		async ({ data, from, to }) => {
			try {
				return {
					content: [{ type: "text", text: convertData({ data, from, to }) }],
				};
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `Error: ${message}` }],
					isError: true,
				};
			}
		},
	);
	registerFindSkillsTool(server);
}
