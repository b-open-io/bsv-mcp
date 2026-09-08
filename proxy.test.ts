import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { VARY_HEADER } from "./lib/content-negotiation";
import { proxy } from "./proxy";

function rewriteFor(path: string, accept: string) {
	const response = proxy(
		new NextRequest(`https://bsvmcp.test${path}`, {
			headers: { accept },
		}),
	);
	return {
		path: response.headers.get("x-middleware-rewrite"),
		vary: response.headers.get("vary"),
	};
}

describe("stable markdown aliases", () => {
	test("rewrites explicit markdown requests to canonical markdown routes", () => {
		expect(rewriteFor("/index.md", "text/markdown")).toEqual({
			path: "https://bsvmcp.test/md",
			vary: VARY_HEADER,
		});
		expect(rewriteFor("/connect.md", "text/markdown").path).toBe(
			"https://bsvmcp.test/md/connect",
		);
		expect(rewriteFor("/docs.md", "text/markdown").path).toBe(
			"https://bsvmcp.test/md/docs",
		);
	});

	test("rewrites normal HTML requests to the corresponding page", () => {
		expect(rewriteFor("/index.md", "text/html").path).toBe(
			"https://bsvmcp.test/",
		);
		expect(rewriteFor("/connect.md", "*/*").path).toBe(
			"https://bsvmcp.test/connect",
		);
		expect(rewriteFor("/docs.md", "").path).toBe("https://bsvmcp.test/docs");
	});
});
