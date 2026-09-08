import type { AuthInfo } from "@modelcontextprotocol/server";

/**
 * The value used for a legacy session when authentication is disabled.
 *
 * AuthInfo is deliberately not synthesized for unauthenticated requests. The
 * sentinel keeps those requests bound to one principal while leaving the
 * existing unauthenticated mode intact.
 */
export const ANONYMOUS_MCP_SESSION_PRINCIPAL = "anonymous";

export type McpSessionPrincipal = string;

type SessionAuthInfo = Pick<AuthInfo, "clientId"> & {
	extra?: AuthInfo["extra"];
};

function nonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	return value.length > 0 ? value : undefined;
}

/**
 * Derive a stable legacy-session principal from verified AuthInfo.
 *
 * Access-token values, scopes, and expiry are intentionally excluded so a
 * refreshed token for the same user can continue an existing session. Hosted
 * verification places the user identity in extra.userId; the local HTTP
 * verifier currently exposes that identity as clientId, so clientId is the
 * compatibility fallback.
 */
export function getMcpSessionPrincipal(
	authInfo?: SessionAuthInfo,
): McpSessionPrincipal {
	const userId = nonEmptyString(authInfo?.extra?.userId);
	if (userId) return `user:${userId}`;

	const clientId = nonEmptyString(authInfo?.clientId);
	if (clientId) return `client:${clientId}`;

	return ANONYMOUS_MCP_SESSION_PRINCIPAL;
}

/**
 * Compare a request principal with the principal captured at initialization.
 */
export function isMcpSessionPrincipalMatch(
	boundPrincipal: McpSessionPrincipal,
	authInfo?: SessionAuthInfo,
): boolean {
	return boundPrincipal === getMcpSessionPrincipal(authInfo);
}
