import { type NextRequest, NextResponse } from "next/server";
import {
	MEDIA_MARKDOWN,
	OFFERED_MEDIA,
	selectMediaType,
	VARY_HEADER,
} from "@/lib/content-negotiation";
import { isMcpRequest, MCP_HANDLER_PATH } from "@/lib/mcp-request";

/** Stable aliases use the same URL for both negotiated representations. */
const STABLE_PAGE_ALIASES: Record<string, string> = {
	"/index.md": "/",
	"/connect.md": "/connect",
	"/docs.md": "/docs",
};

/**
 * Accept negotiation for the site's pages, per acceptmarkdown.com.
 *
 * An agent asking for `text/markdown` is rewritten to the markdown renderer;
 * a browser keeps getting HTML. Either way the response varies on Accept, so a
 * CDN cannot hand one variant to a client that asked for the other. A client
 * that accepts neither gets 406 rather than the wrong media type.
 */
export function proxy(request: NextRequest) {
	// The site root is also the MCP endpoint, so `https://bsvmcp.com` is the
	// whole connection URL with nothing to append. MCP requests are recognised
	// by method and headers and rewritten to the handler; everything else falls
	// through to page negotiation below. /api/mcp keeps working for clients
	// already configured against it.
	if (
		request.nextUrl.pathname === "/" &&
		isMcpRequest(request.method, request.headers)
	) {
		const url = request.nextUrl.clone();
		url.pathname = MCP_HANDLER_PATH;
		return NextResponse.rewrite(url);
	}

	// Tool references support both negotiated Markdown and explicit .md URLs.
	const toolMarkdown =
		request.nextUrl.pathname.startsWith("/docs/tools") &&
		request.nextUrl.pathname.endsWith(".md");
	const accept = request.headers.get("accept");
	const chosen = toolMarkdown
		? MEDIA_MARKDOWN
		: selectMediaType(accept, OFFERED_MEDIA);

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
		const pagePath =
			STABLE_PAGE_ALIASES[request.nextUrl.pathname] ??
			(toolMarkdown
				? request.nextUrl.pathname.slice(0, -3)
				: request.nextUrl.pathname);
		url.pathname = `/md${pagePath === "/" ? "" : pagePath}`;
		const response = NextResponse.rewrite(url);
		response.headers.set("Vary", VARY_HEADER);
		return response;
	}

	const stablePage = STABLE_PAGE_ALIASES[request.nextUrl.pathname];
	if (stablePage) {
		const url = request.nextUrl.clone();
		url.pathname = stablePage;
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
