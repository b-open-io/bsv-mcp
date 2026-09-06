import { AUTH_SERVER_URL, OAUTH_SCOPE_NAMES, SITE_NAME } from "./site";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 *
 * The resource identifier is the MCP endpoint itself, not the site origin,
 * because that is the URI clients send as the RFC 8707 `resource` parameter.
 * RFC 9728 §3.1 then places the metadata at
 * `/.well-known/oauth-protected-resource/api/mcp`, which is what MCP clients
 * request; the bare path is still served for older clients.
 */

/**
 * The MCP endpoint is the site origin, so the resource has no path segment and
 * RFC 9728 places its metadata at the bare well-known path. The legacy
 * `/api/mcp` endpoint still answers, and its path-suffixed metadata is still
 * served for clients configured against it.
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
