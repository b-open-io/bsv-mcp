import type {
	CallToolResult,
	McpServer,
	ProtocolEra,
} from "@modelcontextprotocol/server";

type ToolCallbackFunction = (...args: never[]) => unknown;

function isToolCallback(value: unknown): value is ToolCallbackFunction {
	return typeof value === "function";
}

/** The protocol era selected by the serving entry for this server instance. */
export type ToolPolicyEra = ProtocolEra;

/**
 * The small, reviewed modern surface that is safe to execute without an
 * embedded approval envelope. Keep this list explicit: a newly registered
 * tool is denied by default until its read-only behavior is reviewed.
 */
export const MODERN_READ_TOOL_ALLOWLIST: readonly string[] = Object.freeze([
	"bsv_read",
	"ordinals_read",
	"wallet_read",
	"utility",
	"app_explorer_data",
	"app_ordinals_data",
	"app_sweep_scan",
	"app_wallet_data",
	"bsv_dashboard",
	"bap_getCurrentAddress",
	"bap_getId",
	"bmap_readFollows",
	"bmap_readLikes",
	"bmap_readPosts",
	"bsv_decodeTransaction",
	"bsv_explore",
	"bsv_getPrice",
	"bsv_status",
	"bsocial_readPosts",
	"mnee_getBalance",
	"mnee_parseTx",
	"ordinals_getInscription",
	"ordinals_getTokenByIdOrTicker",
	"ordinals_marketListings",
	"ordinals_marketSales",
	"ordinals_searchInscriptions",
	"utils_convertData",
	"wallet_getAddress",
	"wallet_getBalance",
	"wallet_getBsv21Balances",
	"wallet_getLockData",
	"wallet_getOrdinals",
	"wallet_listTokens",
	"droplit_discover",
]);

const modernReadToolNames = new Set(MODERN_READ_TOOL_ALLOWLIST);

/** Return whether a tool is in the reviewed modern read-only surface. */
export function isModernReadTool(name: string): boolean {
	return modernReadToolNames.has(name);
}

/** Stable error result returned before a denied tool callback is entered. */
export function modernToolDeniedResult(name: string): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text: `Tool ${name} is unavailable for modern MCP requests until its approval policy is reviewed.`,
			},
		],
		isError: true,
	};
}

/**
 * Wrap an untyped callback at the one runtime seam where the SDK's overloaded
 * registration method is invoked. The public server remains an ordinary
 * McpServer, while the callback is replaced before the SDK creates its
 * executor. A denied callback deliberately accepts either SDK callback shape:
 * schema-bearing tools receive (args, ctx), and schema-less tools receive
 * (ctx).
 */
function applyModernToolPolicy(
	era: ToolPolicyEra,
	name: string,
	callback: ToolCallbackFunction,
): ToolCallbackFunction {
	if (era === "legacy" || isModernReadTool(name)) return callback;

	return () => modernToolDeniedResult(name);
}

/**
 * Install the modern tool policy before any tool registrations take place.
 * The Proxy is intentionally limited to registerTool; all other McpServer
 * methods and properties retain native SDK behavior and types.
 */
export function withModernToolPolicy(
	server: McpServer,
	era: ToolPolicyEra,
): McpServer {
	if (era === "legacy") return server;

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

				return Reflect.apply(target.registerTool, target, [
					name,
					config,
					applyModernToolPolicy(era, name, callback),
				]);
			};
		},
	});
}
