/**
 * BSV MCP Cloudflare Worker
 *
 * Stateless MCP server using Streamable HTTP transport (MCP 2025-03-26 spec).
 * Each request creates a fresh McpServer + WebStandardStreamableHTTPServerTransport.
 *
 * Wallet operations use Droplet API mode (no local key storage).
 * OAuth 2.1 via sigma-auth userinfo endpoint.
 */

import { PrivateKey } from "@bsv/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerAllPrompts } from "../../prompts/index.ts";
import { registerResources } from "../../resources/resources.ts";
import { registerAllTools } from "../../tools/index.ts";
import type { ToolsConfig } from "../../tools/index.ts";
import { IntegratedWallet } from "../../tools/wallet/integratedWallet.ts";

/** Cloudflare Worker environment bindings */
interface Env {
	/** Droplet API base URL */
	DROPLIT_API_URL: string;
	/** Droplet faucet name (secret) */
	DROPLIT_FAUCET_NAME: string;
	/** Server payment key in WIF format (secret) */
	SERVER_PRIVATE_KEY_WIF: string;
	/** OAuth issuer URL */
	OAUTH_ISSUER: string;
	/** This worker's public URL (for OAuth resource metadata) */
	RESOURCE_URL?: string;
}

/** Userinfo response from sigma-auth */
interface UserinfoResponse {
	sub: string;
	pubkey?: string;
	email?: string;
	scope?: string;
}

/** CORS headers applied to all /mcp responses */
const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Headers":
		"Content-Type, Authorization, mcp-session-id, Last-Event-ID, mcp-protocol-version",
	"Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
} as const;

/**
 * Validate a Bearer token by calling the sigma-auth userinfo endpoint.
 * Returns user info on success, null if no token present.
 * Throws on invalid/expired tokens.
 */
async function validateOAuthToken(
	request: Request,
	oauthIssuer: string,
): Promise<UserinfoResponse | null> {
	const authHeader = request.headers.get("Authorization");
	if (!authHeader) return null;

	if (!authHeader.startsWith("Bearer ")) {
		throw new Error("Authorization header must use Bearer scheme");
	}

	const token = authHeader.substring(7).trim();
	if (!token) {
		throw new Error("Bearer token is empty");
	}

	const userinfoUrl = `${oauthIssuer}/api/oauth/userinfo`;
	const response = await fetch(userinfoUrl, {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "Unknown error");
		throw new Error(
			`Token validation failed (${response.status}): ${body}`,
		);
	}

	return (await response.json()) as UserinfoResponse;
}

/**
 * Generate WWW-Authenticate header for 401 responses (RFC 9728).
 */
function generateWWWAuthenticate(
	resourceUrl: string,
	error?: string,
	errorDescription?: string,
): string {
	let header = `Bearer realm="BSV-MCP", resource_metadata="${resourceUrl}/.well-known/oauth-protected-resource"`;
	if (error) header += `, error="${error}"`;
	if (errorDescription)
		header += `, error_description="${errorDescription}"`;
	return header;
}

/**
 * Create a fully configured McpServer with tools, prompts, and resources.
 */
function createConfiguredServer(toolsConfig: ToolsConfig): McpServer {
	const server = new McpServer(
		{ name: "bsv-mcp", version: "0.2.10" },
		{
			capabilities: {
				prompts: {},
				resources: {},
				tools: {},
			},
			instructions:
				"This server exposes Bitcoin SV helpers. Tools are idempotent unless marked destructive.",
		},
	);

	registerAllTools(server, toolsConfig);
	registerAllPrompts(server);
	registerResources(server);

	return server;
}

/**
 * Build ToolsConfig for Droplet API mode from worker env.
 */
function buildToolsConfig(env: Env): ToolsConfig {
	let payPk: PrivateKey | undefined;
	try {
		payPk = PrivateKey.fromWif(env.SERVER_PRIVATE_KEY_WIF);
	} catch (e) {
		console.error(
			`Failed to parse SERVER_PRIVATE_KEY_WIF: ${e instanceof Error ? e.message : String(e)}`,
		);
	}

	let integratedWallet: IntegratedWallet | undefined;
	if (env.DROPLIT_FAUCET_NAME) {
		try {
			integratedWallet = new IntegratedWallet({
				useDropletApi: true,
				dropletConfig: {
					apiUrl: env.DROPLIT_API_URL,
					faucetName: env.DROPLIT_FAUCET_NAME,
				},
				paymentKey: payPk,
			});
		} catch (e) {
			console.error(
				`Failed to init IntegratedWallet: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}

	return {
		enableBsvTools: true,
		enableOrdinalsTools: true,
		enableUtilsTools: true,
		enableWalletTools: !!integratedWallet,
		enableMneeTools: false,
		enableBapTools: false,
		enableBsocialTools: false,
		enableA2bTools: false,
		disableBroadcasting: false,
		payPk,
		integratedWallet,
	};
}

/**
 * Append CORS headers to a Response (mutates existing headers).
 */
function addCorsHeaders(response: Response): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(CORS_HEADERS)) {
		if (!headers.has(key)) headers.set(key, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// --- CORS preflight ---
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}

		// --- Health check ---
		if (request.method === "GET" && url.pathname === "/health") {
			return Response.json(
				{ status: "ok", server: "bsv-mcp", version: "0.2.10" },
				{ headers: { "Access-Control-Allow-Origin": "*" } },
			);
		}

		const oauthIssuer = env.OAUTH_ISSUER;
		const resourceUrl =
			env.RESOURCE_URL || `${url.protocol}//${url.host}`;

		// --- OAuth 2.1 Authorization Server Metadata ---
		if (
			request.method === "GET" &&
			url.pathname === "/.well-known/oauth-authorization-server"
		) {
			return Response.json(
				{
					issuer: oauthIssuer,
					authorization_endpoint: `${oauthIssuer}/api/oauth/authorize`,
					token_endpoint: `${oauthIssuer}/api/oauth/token`,
					userinfo_endpoint: `${oauthIssuer}/api/oauth/userinfo`,
					jwks_uri: `${oauthIssuer}/.well-known/jwks.json`,
					registration_endpoint: `${oauthIssuer}/api/oauth/register`,
					scopes_supported: [
						"openid",
						"profile",
						"email",
						"offline_access",
						"bsv:tools",
						"bsv:wallet",
						"bsv:ordinals",
						"bsv:tokens",
					],
					response_types_supported: ["code"],
					grant_types_supported: [
						"authorization_code",
						"refresh_token",
					],
					token_endpoint_auth_methods_supported: ["none"],
					code_challenge_methods_supported: ["S256"],
				},
				{
					headers: {
						"Access-Control-Allow-Origin": "*",
						"Cache-Control": "public, max-age=3600",
					},
				},
			);
		}

		// --- OAuth 2.1 Protected Resource Metadata (RFC 9728) ---
		if (
			request.method === "GET" &&
			url.pathname === "/.well-known/oauth-protected-resource"
		) {
			return Response.json(
				{
					resource: resourceUrl,
					authorization_servers: [oauthIssuer],
					scopes_supported: [
						"openid",
						"profile",
						"email",
						"bsv:tools",
						"bsv:wallet",
						"bsv:ordinals",
						"bsv:tokens",
					],
					bearer_methods_supported: ["header"],
					resource_signing_alg_values_supported: ["RS256", "ES256"],
				},
				{
					headers: {
						"Access-Control-Allow-Origin": "*",
						"Cache-Control": "public, max-age=3600",
					},
				},
			);
		}

		// --- MCP Streamable HTTP endpoint ---
		if (url.pathname === "/mcp") {
			// Validate OAuth token
			let authInfo:
				| { token: string; clientId: string; scopes: string[] }
				| undefined;
			try {
				const userCtx = await validateOAuthToken(request, oauthIssuer);
				if (userCtx) {
					authInfo = {
						token:
							request.headers
								.get("Authorization")
								?.substring(7) || "",
						clientId: userCtx.sub,
						scopes: userCtx.scope?.split(" ") || [],
					};
					console.log(
						`Authenticated: ${userCtx.sub} (pubkey: ${userCtx.pubkey?.substring(0, 20)}...)`,
					);
				}
			} catch (error) {
				const msg =
					error instanceof Error
						? error.message
						: "Token validation failed";
				return addCorsHeaders(
					new Response(
						JSON.stringify({
							error: "invalid_token",
							message: msg,
						}),
						{
							status: 401,
							headers: {
								"Content-Type": "application/json",
								"WWW-Authenticate": generateWWWAuthenticate(
									resourceUrl,
									"invalid_token",
									msg,
								),
							},
						},
					),
				);
			}

			// Stateless: fresh server + transport per request
			const toolsConfig = buildToolsConfig(env);
			const mcpServer = createConfiguredServer(toolsConfig);
			const transport = new WebStandardStreamableHTTPServerTransport();
			await mcpServer.connect(transport);

			const response = await transport.handleRequest(request, {
				authInfo,
			});
			return addCorsHeaders(response);
		}

		return new Response("Not Found", { status: 404 });
	},
};
