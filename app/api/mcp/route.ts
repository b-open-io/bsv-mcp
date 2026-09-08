import { PrivateKey } from "@bsv/sdk";
import {
	type AuthInfo,
	createMcpHandler,
	type McpRequestContext,
	McpServer,
} from "@modelcontextprotocol/server";
import { withMcpAuth } from "mcp-handler";
import { verifyHostedToken } from "@/lib/hosted-auth";
import { RESOURCE_METADATA_PATH } from "@/lib/oauth-metadata";
import packageJson from "@/package.json";
import { registerAllTools } from "@/tools";
import { resolveToolCatalogFromEnvironment } from "@/tools/compactCatalog";
import { withModernToolPolicy } from "@/utils/modernToolPolicy";

// This Next.js route wraps the BSV MCP server for Vercel deployment
// Tools are registered dynamically based on available keys and config
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
				capabilities: {
					tools: {},
				},
			},
		);
		const server = withModernToolPolicy(nativeServer, requestContext.era);

		// Get keys from environment
		const payPkWif = process.env.PRIVATE_KEY_WIF;
		const identityPkWif = process.env.IDENTITY_KEY_WIF;

		let payPk: PrivateKey | undefined;
		let identityPk: PrivateKey | undefined;

		try {
			if (payPkWif) payPk = PrivateKey.fromWif(payPkWif);
		} catch {
			console.error("Invalid PRIVATE_KEY_WIF");
		}

		try {
			if (identityPkWif) identityPk = PrivateKey.fromWif(identityPkWif);
		} catch {
			console.error("Invalid IDENTITY_KEY_WIF");
		}

		// Register all tools based on environment configuration and available keys
		registerAllTools(server, {
			toolCatalog: configuredToolCatalog,
			payPk,
			identityPk,
			enableBsvTools: process.env.DISABLE_BSV_TOOLS !== "true",
			enableOrdinalsTools: process.env.DISABLE_ORDINALS_TOOLS !== "true",
			enableUtilsTools: process.env.DISABLE_UTILS_TOOLS !== "true",
			enableBapTools: process.env.DISABLE_BAP_TOOLS !== "true",
			enableBsocialTools: process.env.DISABLE_BSOCIAL_TOOLS !== "true",
			enableWalletTools: process.env.DISABLE_WALLET_TOOLS !== "true",
			enableMneeTools: process.env.DISABLE_MNEE_TOOLS !== "true",
			disableBroadcasting: process.env.DISABLE_BROADCASTING === "true",
		});

		console.error("BSV MCP Server initialized for Vercel");
		console.error(`Payment key: ${payPk ? "present" : "missing"}`);
		console.error(`Identity key: ${identityPk ? "present" : "missing"}`);
		return server;
	},
	{
		legacy: "stateless",
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
	// RFC 9728 §3.1: the metadata for a resource under a path lives at the
	// well-known prefix with that path appended. Pointing the challenge at the
	// bare path sends clients somewhere the spec does not expect.
	resourceMetadataPath: RESOURCE_METADATA_PATH,
});

export {
	withAuth as GET,
	withAuth as POST,
	withAuth as DELETE,
	withAuth as OPTIONS,
};
