/**
 * Detects a Model Context Protocol request so the site root can serve both the
 * landing page and the MCP server.
 *
 * Streamable HTTP is unambiguous enough to key on: clients POST JSON-RPC,
 * open the stream with a `text/event-stream` GET, end a session with DELETE,
 * and carry MCP-specific headers. A browser does none of those things, so the
 * two audiences never collide on the same URL.
 */

/** The first protocol revision using stateless, header-routed requests. */
export const MODERN_MCP_PROTOCOL_VERSION = "2026-07-28";

/** Headers only an MCP client sends. */
const MCP_HEADERS = [
	"mcp-session-id",
	"mcp-protocol-version",
	"mcp-method",
	"mcp-name",
] as const;

function hasMcpHeader(headers: Headers): boolean {
	return MCP_HEADERS.some((name) => headers.has(name));
}

function acceptsEventStream(headers: Headers): boolean {
	return (headers.get("accept") ?? "")
		.toLowerCase()
		.includes("text/event-stream");
}

function sendsJson(headers: Headers): boolean {
	const contentType = headers.get("content-type");
	if (!contentType) return false;

	// MCP's Streamable HTTP transport requires application/json. Parameters
	// such as a charset are valid, but other media types are not.
	return (
		contentType.split(";", 1)[0]?.trim().toLowerCase() === "application/json"
	);
}

function isModernProtocolVersion(value: string): boolean {
	// Protocol revisions are ISO dates. Comparing their canonical form keeps
	// this forward-compatible with later revisions without accepting arbitrary
	// values that merely happen to start with "2026".
	return (
		/^\d{4}-\d{2}-\d{2}$/.test(value) && value >= MODERN_MCP_PROTOCOL_VERSION
	);
}

/**
 * True for a modern (2026-07-28 or later) stateless MCP request.
 *
 * Modern requests do not carry Mcp-Session-Id. Mcp-Method is the required
 * routing header; Mcp-Name is required by the protocol for named operations
 * such as tools/call, but is intentionally not required here because this
 * classifier cannot inspect the JSON-RPC params body.
 */
export function isModernMcpRequest(method: string, headers: Headers): boolean {
	if (method.toUpperCase() !== "POST") return false;
	const protocolVersion = headers.get("mcp-protocol-version");
	return (
		protocolVersion !== null &&
		isModernProtocolVersion(protocolVersion.trim()) &&
		headers.has("mcp-method") &&
		sendsJson(headers)
	);
}

/**
 * True when this request should be handled by the MCP server rather than the
 * page. Deliberately conservative: a plain GET for HTML or markdown is never
 * treated as MCP.
 */
export function isMcpRequest(method: string, headers: Headers): boolean {
	if (isModernMcpRequest(method, headers)) return true;
	if (hasMcpHeader(headers)) return true;

	switch (method.toUpperCase()) {
		case "POST":
			// JSON-RPC over Streamable HTTP.
			return sendsJson(headers) || acceptsEventStream(headers);
		case "GET":
			// Opening the server-to-client stream.
			return acceptsEventStream(headers);
		case "DELETE":
			// Ending a session.
			return true;
		default:
			return false;
	}
}

/** Where MCP requests are actually handled. */
export const MCP_HANDLER_PATH = "/api/mcp";
