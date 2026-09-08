import { AUTH_SERVER_URL, OAUTH_SCOPE_NAMES, SITE_NAME } from "./site";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 *
 * The canonical MCP endpoint is the site origin (`MCP_ENDPOINT = SITE_URL`),
 * so the resource identifier is the origin itself — the exact URI clients send
 * as the RFC 8707 `resource` parameter. A path-less resource takes the bare
 * well-known path, and the legacy `/api/mcp` endpoint keeps a path-suffixed
 * metadata alias that serves the same canonical resource for clients
 * configured against it.
 */
export const MCP_RESOURCE_PATH = "api/mcp";

/** Where RFC 9728 says this resource's metadata lives. */
export const RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource";

export interface ProtectedResourceMetadata {
	resource: string;
	authorization_servers: string[];
	scopes_supported: string[];
	bearer_methods_supported: string[];
	resource_name: string;
	resource_documentation: string;
}

export function protectedResourceMetadata(
	origin: string,
): ProtectedResourceMetadata {
	return {
		resource: origin,
		authorization_servers: [AUTH_SERVER_URL],
		scopes_supported: OAUTH_SCOPE_NAMES,
		bearer_methods_supported: ["header"],
		resource_name: SITE_NAME,
		resource_documentation: `${origin}/llms.txt`,
	};
}

export const METADATA_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Cache-Control": "public, max-age=3600",
} as const;

export const METADATA_CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;
