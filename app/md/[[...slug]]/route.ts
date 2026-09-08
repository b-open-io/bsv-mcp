import { NextResponse } from "next/server";
import { VARY_HEADER } from "@/lib/content-negotiation";
import { markdownPages, renderNotFoundMarkdown } from "@/lib/markdown";

/**
 * Markdown renderings of the site's pages.
 *
 * Reachable directly (`/md`, `/md/connect`), through the `.md` rewrites, and
 * through Accept negotiation in proxy.
 */

const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

function markdownResponse(body: string, status: number) {
	return new NextResponse(body, {
		status,
		headers: {
			"Content-Type": MARKDOWN_CONTENT_TYPE,
			Vary: VARY_HEADER,
			"Cache-Control": "public, max-age=0, must-revalidate",
			"Access-Control-Allow-Origin": "*",
		},
	});
}

export async function GET(
	_request: Request,
	context: { params: Promise<{ slug?: string[] }> },
) {
	const { slug } = await context.params;
	const path = `/${(slug ?? []).join("/")}`.replace(/\/$/, "") || "/";

	const render = markdownPages[path];
	if (!render) {
		return markdownResponse(renderNotFoundMarkdown(path), 404);
	}

	return markdownResponse(render(), 200);
}
