import { describe, expect, test } from "bun:test";
import { renderDocsMarkdown } from "./docs";
import {
	markdownPages,
	renderConnectMarkdown,
	renderHomeMarkdown,
	renderNotFoundMarkdown,
} from "./markdown";
import { MCP_ENDPOINT, OAUTH_SCOPE_NAMES, SITE_URL } from "./site";
import { toolCategories } from "./site-content";

describe("home markdown", () => {
	const doc = renderHomeMarkdown();

	test("starts with a single H1", () => {
		expect(doc.startsWith("# ")).toBe(true);
		expect(doc.split("\n").filter((l) => l.startsWith("# ")).length).toBe(1);
	});

	test("names every tool category", () => {
		for (const category of toolCategories) {
			expect(doc).toContain(category.name);
		}
	});

	test("publishes the endpoint and scopes agents need", () => {
		expect(doc).toContain(MCP_ENDPOINT);
		for (const scope of OAUTH_SCOPE_NAMES) {
			expect(doc).toContain(scope);
		}
	});
});

describe("connect markdown", () => {
	test("explains the auth model and links discovery", () => {
		const doc = renderConnectMarkdown();
		expect(doc).toContain(MCP_ENDPOINT);
		expect(doc).toContain("/.well-known/oauth-protected-resource");
	});
});

describe("not found markdown", () => {
	const doc = renderNotFoundMarkdown("/nope");

	test("names the missing path", () => {
		expect(doc).toContain("/nope");
	});

	test("points agents at every recovery route", () => {
		for (const target of ["/llms.txt", "/sitemap.xml", `${SITE_URL}/connect`]) {
			expect(doc).toContain(target);
		}
	});

	test("includes machine-readable endpoints", () => {
		expect(doc).toContain(MCP_ENDPOINT);
	});
});

describe("markdownPages", () => {
	test("covers the routes proxy can rewrite", () => {
		expect(Object.keys(markdownPages).sort()).toEqual([
			"/",
			"/connect",
			"/docs",
		]);
		for (const render of Object.values(markdownPages)) {
			expect(render().length).toBeGreaterThan(100);
		}
	});
});

test("documentation keeps task examples with their headings", () => {
	const doc = renderDocsMarkdown();
	const start = doc.indexOf("### Browse listings and recent sales");
	const end = doc.indexOf("### Find assets belonging to an address");
	expect(start).toBeGreaterThan(0);
	expect(end).toBeGreaterThan(start);
	expect(doc.slice(start, end)).toContain('{"q":"cat","limit":20}');
	expect(doc).toContain("## Advanced tool settings");
});

test("BRC references link to Beersy without changing environment names", () => {
	const doc = renderDocsMarkdown();
	expect(doc).toContain("[BRC-169](https://www.beersy.dev/brc/169)");
	expect(doc).toContain("[BRC-100](https://www.beersy.dev/brc/100)");
	expect(doc).toContain("BRC100_WALLET_URL");
	expect(renderHomeMarkdown()).toContain(
		"[BRC-100](https://www.beersy.dev/brc/100)",
	);
});
