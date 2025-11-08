import { NextResponse } from "next/server";

// OAuth 2.1 Authorization Server Metadata (MCP spec requirement)
// This tells MCP clients where to find sigma-auth for authentication
export async function GET() {
  const authServer = process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com";

  // OAuth 2.1 metadata pointing to Better Auth OIDC Provider
  const metadata = {
    issuer: authServer,
    authorization_endpoint: `${authServer}/api/auth/oauth2/authorize`,
    token_endpoint: `${authServer}/api/auth/oauth2/token`,
    registration_endpoint: `${authServer}/api/auth/oauth2/register`,
    jwks_uri: `${authServer}/api/auth/jwks`,
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
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    code_challenge_methods_supported: ["S256"],
  };

  return NextResponse.json(metadata, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
