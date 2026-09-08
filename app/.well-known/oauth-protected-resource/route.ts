import { type NextRequest, NextResponse } from "next/server";
import {
	METADATA_CORS_HEADERS,
	METADATA_HEADERS,
	protectedResourceMetadata,
} from "@/lib/oauth-metadata";

/**
 * Canonical RFC 9728 metadata at the bare well-known path.
 *
 * The resource is the site origin, so there is no path segment to insert.
 * The legacy `/api/mcp` alias in the sibling catch-all route serves the same
 * canonical resource for clients configured against it.
 */
export async function GET(request: NextRequest) {
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
