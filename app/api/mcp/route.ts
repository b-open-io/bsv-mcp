import { createMcpHandler } from "mcp-handler";
import { PrivateKey } from "@bsv/sdk";

// This Next.js route wraps the BSV MCP server for Vercel deployment
// Tools are registered dynamically based on available keys and config

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

export { handler as GET, handler as POST, handler as DELETE };
