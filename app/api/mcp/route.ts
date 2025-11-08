import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { PrivateKey } from "@bsv/sdk";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { registerAllTools } from "@/tools";

// This Next.js route wraps the BSV MCP server for Vercel deployment
// Tools are registered dynamically based on available keys and config

// Token verification function for OAuth 2.1
// Validates opaque tokens and fetches user identity from userinfo endpoint
const verifyToken = async (
  req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) {
    return undefined;
  }

  try {
    const authServer = process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com";

    // Call userinfo endpoint to get full user identity (standard OAuth/OIDC pattern)
    const response = await fetch(`${authServer}/api/oauth/userinfo`, {
      headers: {
        "Authorization": `Bearer ${bearerToken}`,
      },
    });

    if (!response.ok) {
      console.error("Token validation failed:", response.status, await response.text());
      return undefined;
    }

    const userinfo = await response.json();

    // Extract scopes - userinfo includes token_scope in dev mode
    // For production, we'll need to call get-session separately or parse from id_token
    const scopes = userinfo.token_scope ? userinfo.token_scope.split(" ") : ["openid", "profile"];

    return {
      token: bearerToken,
      clientId: userinfo.sub || "unknown",
      scopes,
      // Store user identity for tools to access
      metadata: {
        userId: userinfo.sub,
        pubkey: userinfo.pubkey,
        bapId: userinfo.bap_id,
        bitcoinAddress: userinfo.bitcoin_address,
        email: userinfo.email,
      },
    };
  } catch (error) {
    console.error("Token validation error:", error);
    return undefined;
  }
};

const handler = createMcpHandler(
  async (server) => {
    // Get keys from environment
    const payPkWif = process.env.PRIVATE_KEY_WIF;
    const identityPkWif = process.env.IDENTITY_KEY_WIF;

    let payPk: PrivateKey | undefined;
    let identityPk: PrivateKey | undefined;

    try {
      if (payPkWif) payPk = PrivateKey.fromWif(payPkWif);
    } catch (e) {
      console.error("Invalid PRIVATE_KEY_WIF");
    }

    try {
      if (identityPkWif) identityPk = PrivateKey.fromWif(identityPkWif);
    } catch (e) {
      console.error("Invalid IDENTITY_KEY_WIF");
    }

    // Register all tools based on environment configuration and available keys
    registerAllTools(server, {
      payPk,
      identityPk,
      enableBsvTools: process.env.DISABLE_BSV_TOOLS !== "true",
      enableOrdinalsTools: process.env.DISABLE_ORDINALS_TOOLS !== "true",
      enableUtilsTools: process.env.DISABLE_UTILS_TOOLS !== "true",
      enableA2bTools: process.env.ENABLE_A2B_TOOLS === "true",
      enableBapTools: process.env.DISABLE_BAP_TOOLS !== "true",
      enableBsocialTools: process.env.DISABLE_BSOCIAL_TOOLS !== "true",
      enableWalletTools: process.env.DISABLE_WALLET_TOOLS !== "true",
      enableMneeTools: process.env.DISABLE_MNEE_TOOLS !== "true",
      enableBigBlocksTools: false, // Disabled - module resolution issues with Turbopack
      disableBroadcasting: process.env.DISABLE_BROADCASTING === "true",
    });

    console.log("BSV MCP Server initialized for Vercel");
    console.log(`Payment key: ${payPk ? "present" : "missing"}`);
    console.log(`Identity key: ${identityPk ? "present" : "missing"}`);
  },
  {
    capabilities: {
      tools: {},
    },
  },
  {
    basePath: "/api",
    verboseLogs: true,
    maxDuration: 300, // 5 minutes for Pro accounts
    disableSse: false, // Enable SSE for streaming
  },
);

// Wrap handler with OAuth authentication
const withAuth = withMcpAuth(handler, verifyToken, {
  required: process.env.ENABLE_OAUTH !== "false",
  requiredScopes: [],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { withAuth as GET, withAuth as POST, withAuth as DELETE, withAuth as OPTIONS };
