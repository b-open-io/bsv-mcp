/**
 * Detects a Model Context Protocol request so the site root can serve both the
 * landing page and the MCP server.
 *
 * Streamable HTTP is unambiguous enough to key on: clients POST JSON-RPC,
 * open the stream with a `text/event-stream` GET, end a session with DELETE,
 * and carry MCP-specific headers. A browser does none of those things, so the
 * two audiences never collide on the same URL.
 */

/** Headers only an MCP client sends. */
const MCP_HEADERS = ["mcp-session-id", "mcp-protocol-version"] as const;

function hasMcpHeader(headers: Headers): boolean {
	return MCP_HEADERS.some((name) => headers.has(name));
}

function acceptsEventStream(headers: Headers): boolean {
	return (headers.get("accept") ?? "")
		.toLowerCase()
		.includes("text/event-stream");
}

function sendsJson(headers: Headers): boolean {
	return (headers.get("content-type") ?? "")
		.toLowerCase()
		.includes("application/json");
}

/**
 * True when this request should be handled by the MCP server rather than the
 * page. Deliberately conservative: a plain GET for HTML or markdown is never
 * treated as MCP.
 */
export function isMcpRequest(method: string, headers: Headers): boolean {
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
