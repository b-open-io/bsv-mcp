import {
	type AuthInfo,
	createMcpHandler,
	type McpRequestContext,
	McpServer,
} from "@modelcontextprotocol/server";
import { withMcpAuth } from "mcp-handler";
import { verifyHostedToken } from "@/lib/hosted-auth";
import {
	registerHostedReadTools,
	withHostedReadPolicy,
} from "@/lib/hosted-read-policy";
import { RESOURCE_METADATA_PATH } from "@/lib/oauth-metadata";
import packageJson from "@/package.json";
import {
	registerCompactCatalog,
	resolveToolCatalogFromEnvironment,
} from "@/tools/compactCatalog";
import { readMcpProtocolPolicy } from "@/utils/mcpProtocol";
import { withMcpToolExecution } from "@/utils/mcpToolExecution";

// This Next.js route wraps the BSV MCP server for Vercel deployment as a
// public read-only endpoint. It never reads or parses key material
// (`PRIVATE_KEY_WIF`, `IDENTITY_KEY_WIF`, or any equivalent) and registers no
// wallet, account, BAP identity, MNEE, x402, or other private/mutating
// capability. The boundary holds independently of `DISABLE_BROADCASTING` and
// any inherited key-like environment variables. Local stdio and Bun HTTP
// behavior live elsewhere and are unchanged by this file.
const protocolPolicy = readMcpProtocolPolicy();
const configuredToolCatalog = resolveToolCatalogFromEnvironment();

// Bearer-only transport: Better Auth rejects sender-bound tokens here.
const verifyToken = async (
	_req: Request,
	bearerToken?: string,
): Promise<AuthInfo | undefined> => {
	if (!bearerToken) return undefined;
	try {
		const claims = await verifyHostedToken(bearerToken);
		return {
			token: bearerToken,
			clientId:
				typeof claims.client_id === "string"
					? claims.client_id
					: String(claims.azp ?? ""),
			scopes: typeof claims.scope === "string" ? claims.scope.split(" ") : [],
			expiresAt: claims.exp,
			extra: { userId: claims.sub },
		};
	} catch {
		return undefined;
	}
};

const sdkHandler = createMcpHandler(
	async (requestContext: McpRequestContext) => {
		const nativeServer = new McpServer(
			{
				name: "bsv-mcp",
				version: packageJson.version,
			},
			{
				supportedProtocolVersions: protocolPolicy.supportedVersions,
				capabilities: {
					tools: {},
				},
			},
		);
		// Hosted traffic remains public read-only in every protocol era.
		// The local execution adapter never expands the hosted allowlist.
		const server = withHostedReadPolicy(
			withMcpToolExecution(nativeServer, requestContext.era),
		);

		if (configuredToolCatalog === "compact") {
			// No wallet, account, or signer configuration is passed, so only
			// the read families (bsv_read, ordinals_read, utility) materialize.
			registerCompactCatalog(server, {});
		} else {
			registerHostedReadTools(server);
		}

		console.error("BSV MCP Server initialized for Vercel (read-only)");
		return server;
	},
	{
		legacy: protocolPolicy.legacyCompatibility ? "stateless" : "reject",
		onerror: (error) => console.error("MCP handler error:", error),
	},
);

// mcp-handler's auth wrapper populates req.auth after verification. The native
// SDK handler only accepts that verified value through its fetch options.
const handler = (req: Request) => sdkHandler.fetch(req, { authInfo: req.auth });

// Wrap handler with OAuth authentication
const withAuth = withMcpAuth(handler, verifyToken, {
	required: process.env.ENABLE_OAUTH !== "false",
	requiredScopes: [],
	// Canonical resource is the site root, so the challenge names the bare
	// well-known metadata path (RFC 9728 §3.1). The legacy /api/mcp alias
	// serves the same canonical metadata.
	resourceMetadataPath: RESOURCE_METADATA_PATH,
});

/**
 * CORS boundary for browser MCP clients.
 *
 * Preflight never enters OAuth verification: OPTIONS is answered here with
 * 204. Auth challenges and successful MCP responses carry the same CORS
 * headers via withCors.
 */
const CORS_ALLOW_METHODS = "GET, POST, DELETE, OPTIONS";
const CORS_ALLOW_HEADERS = [
	"authorization",
	"content-type",
	"mcp-session-id",
	"last-event-id",
	"mcp-protocol-version",
	"mcp-method",
	"mcp-name",
].join(", ");
const CORS_EXPOSE_HEADERS = [
	"mcp-session-id",
	"mcp-protocol-version",
	"www-authenticate",
].join(", ");

function corsHeaders(): Headers {
	const headers = new Headers();
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
	headers.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
	headers.set("Access-Control-Expose-Headers", CORS_EXPOSE_HEADERS);
	return headers;
}

function withCors(response: Response): Response {
	const headers = new Headers(response.headers);
	for (const [name, value] of corsHeaders()) headers.set(name, value);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export async function OPTIONS() {
	return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
	return withCors(await withAuth(req));
}

export async function POST(req: Request) {
	return withCors(await withAuth(req));
}

export async function DELETE(req: Request) {
	return withCors(await withAuth(req));
}
