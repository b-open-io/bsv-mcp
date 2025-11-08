import { NextResponse } from "next/server";

export async function GET() {
  const resourceUrl = process.env.RESOURCE_URL || "https://bsv-mcp.vercel.app";
  const authServer = process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com";

  const metadata = {
    resource: resourceUrl,
    authorization_servers: [authServer],
  };

  return NextResponse.json(metadata, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
