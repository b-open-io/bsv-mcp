import { NextResponse } from "next/server";

// OAuth 2.1 Authorization Server Metadata (MCP spec requirement)
// This tells MCP clients where to find sigma-auth for authentication
export async function GET() {
  const authServer = process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com";

  const metadata = {
    issuer: authServer,
    authorization_endpoint: `${authServer}/api/oauth/authorize`,
    token_endpoint: `${authServer}/api/oauth/token`,
    userinfo_endpoint: `${authServer}/api/oauth/userinfo`,
    jwks_uri: `${authServer}/.well-known/jwks.json`,
    registration_endpoint: `${authServer}/api/oauth/register`,
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
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
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
