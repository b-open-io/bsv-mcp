import { type NextRequest, NextResponse } from "next/server";
import { AUTH_SERVER_URL, OAUTH_SCOPE_NAMES, SITE_NAME } from "@/lib/site";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 *
 * Declaring `scopes_supported` here is what lets an agent request least
 * privilege: without it a client has no machine-readable way to know which
 * scopes this resource understands. The resource identifier is derived from
 * the request origin, so previews and production each describe themselves.
 */
function metadataFor(request: NextRequest) {
	const origin = request.nextUrl.origin;

	return {
		resource: origin,
		authorization_servers: [AUTH_SERVER_URL],
		scopes_supported: OAUTH_SCOPE_NAMES,
		bearer_methods_supported: ["header"],
		resource_name: SITE_NAME,
		resource_documentation: `${origin}/llms.txt`,
	};
}

export async function GET(request: NextRequest) {
	return NextResponse.json(metadataFor(request), {
		headers: {
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
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
	});
}
