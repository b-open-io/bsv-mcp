import { type NextRequest, NextResponse } from "next/server";
import {
	MCP_RESOURCE_PATH,
	METADATA_CORS_HEADERS,
	METADATA_HEADERS,
	protectedResourceMetadata,
} from "@/lib/oauth-metadata";

/**
 * RFC 9728 §3.1 metadata for a resource that lives under a path.
 *
 * For the resource `https://host/api/mcp`, clients insert the resource path
 * into the well-known URL and request
 * `https://host/.well-known/oauth-protected-resource/api/mcp`. Without this
 * route that request 404s and a client cannot discover the authorization
 * server, which is where Claude's connector flow stops.
 */
export async function GET(
	request: NextRequest,
	context: { params: Promise<{ path?: string[] }> },
) {
	const { path } = await context.params;
	const requested = (path ?? []).join("/");

	if (requested !== MCP_RESOURCE_PATH) {
		return NextResponse.json(
			{
				error: "not_found",
				error_description: `No protected resource is published at /${requested}. This server publishes /${MCP_RESOURCE_PATH}.`,
			},
			{ status: 404, headers: METADATA_HEADERS },
		);
	}

	return NextResponse.json(protectedResourceMetadata(request.nextUrl.origin), {
		headers: METADATA_HEADERS,
	});
}

export async function OPTIONS() {
	return new NextResponse(null, {
		status: 204,
		headers: METADATA_CORS_HEADERS,
	});
}
