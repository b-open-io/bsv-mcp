import { type NextRequest, NextResponse } from "next/server";
import {
	METADATA_CORS_HEADERS,
	METADATA_HEADERS,
	protectedResourceMetadata,
} from "@/lib/oauth-metadata";

/**
 * RFC 9728 metadata at the bare well-known path.
 *
 * MCP clients following the spec request the path-suffixed form handled by the
 * sibling catch-all route. This one stays for clients that request the bare
 * path, and for anything still pointing at the previous location.
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
