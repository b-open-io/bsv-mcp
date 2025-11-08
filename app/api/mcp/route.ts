import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { PrivateKey } from "@bsv/sdk";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

// This Next.js route wraps the BSV MCP server for Vercel deployment
// Tools are registered dynamically based on available keys and config

// Token verification function for OAuth 2.1
// Validates opaque tokens by calling Better Auth's session endpoint
const verifyToken = async (
  req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) {
    return undefined;
  }

  try {
    const authServer = process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com";

    // Call Better Auth's get-session endpoint to validate the token
    const response = await fetch(`${authServer}/api/auth/mcp/get-session`, {
      headers: {
        "Authorization": `Bearer ${bearerToken}`,
      },
    });

    if (!response.ok) {
      console.error("Token validation failed:", response.status, await response.text());
      return undefined;
    }

    const session = await response.json();

    // Extract scopes from the session
    const scopes = session.scopes ? session.scopes.split(" ") : [];

    return {
      token: bearerToken,
      clientId: session.clientId || "unknown",
      scopes,
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

    // Import and register tool categories
    // Note: This is a simplified version - full tool registration would import from ../../tools/
    // For now, we'll add a basic set of tools to get started

    server.tool(
      "help",
      "Show help information about BSV MCP Server",
      {},
      async () => ({
        content: [{
          type: "text",
          text: `BSV MCP Server - Vercel Deployment

Available tool categories will be registered based on environment configuration.

Status:
- Payment Key: ${payPk ? "✓ Configured" : "✗ Not configured"}
- Identity Key: ${identityPk ? "✓ Configured" : "✗ Not configured"}

To enable full functionality, set environment variables:
- PRIVATE_KEY_WIF: Payment operations
- IDENTITY_KEY_WIF: BAP identity operations
- ENABLE_OAUTH: OAuth 2.1 authentication (default: true)
- OAUTH_ISSUER: Authorization server URL`
        }]
      })
    );

    // Basic info tool
    server.tool(
      "server_info",
      "Get server configuration and status",
      {},
      async () => ({
        content: [{
          type: "text",
          text: JSON.stringify({
            version: "0.2.0-alpha.1",
            transport: "http",
            oauth_enabled: process.env.ENABLE_OAUTH !== "false",
            oauth_issuer: process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com",
            capabilities: {
              wallet: !!payPk,
              identity: !!identityPk,
            }
          }, null, 2)
        }]
      })
    );

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
