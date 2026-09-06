import { type NextRequest, NextResponse } from "next/server";
import {
	MEDIA_MARKDOWN,
	OFFERED_MEDIA,
	selectMediaType,
	VARY_HEADER,
} from "@/lib/content-negotiation";

/**
 * Accept negotiation for the site's pages, per acceptmarkdown.com.
 *
 * An agent asking for `text/markdown` is rewritten to the markdown renderer;
 * a browser keeps getting HTML. Either way the response varies on Accept, so a
 * CDN cannot hand one variant to a client that asked for the other. A client
 * that accepts neither gets 406 rather than the wrong media type.
 */
export function middleware(request: NextRequest) {
	const accept = request.headers.get("accept");
	const chosen = selectMediaType(accept, OFFERED_MEDIA);

	if (chosen === null) {
		return new NextResponse(
			`# 406 — Not acceptable\n\nThis URL can be served as ${OFFERED_MEDIA.join(
				" or ",
			)}.\n`,
			{
				status: 406,
				headers: {
					"Content-Type": "text/markdown; charset=utf-8",
					Vary: VARY_HEADER,
				},
			},
		);
	}

	if (chosen === MEDIA_MARKDOWN) {
		const url = request.nextUrl.clone();
		url.pathname = `/md${request.nextUrl.pathname}`.replace(/\/$/, "");
		const response = NextResponse.rewrite(url);
		response.headers.set("Vary", VARY_HEADER);
		return response;
	}

	// Best effort only. Next and Vercel set Vary on prerendered page responses
	// and that value wins over middleware, next.config headers and the CDN
	// header config alike (all three verified in production). Route handlers do
	// keep their own headers, so the markdown variants declare it correctly.
	//
	// Correctness does not depend on it: markdown requests are rewritten to
	// /md/*, so the two representations occupy different cache keys and a CDN
	// cannot serve one in place of the other.
	const response = NextResponse.next();
	response.headers.append("Vary", "Accept");
	return response;
}

export const config = {
	/**
	 * Page routes only. API routes, OAuth discovery documents, the markdown
	 * renderer itself and static assets negotiate their own content types.
	 */
	matcher: [
		"/((?!api|md|_next/static|_next/image|\\.well-known|llms\\.txt|robots\\.txt|sitemap\\.xml|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|json|webmanifest)$).*)",
	],
};
