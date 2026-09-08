import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { VARY_HEADER } from "./lib/content-negotiation";
import { proxy } from "./proxy";

function rewriteFor(
	path: string,
	accept: string,
	method = "GET",
	extraHeaders: Record<string, string> = {},
) {
	const response = proxy(
		new NextRequest(`https://bsvmcp.test${path}`, {
			method,
			headers: { accept, ...extraHeaders },
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

describe("root MCP routing", () => {
	test("rewrites a modern stateless request without a session", () => {
		expect(
			rewriteFor("/", "application/json", "POST", {
				"content-type": "application/json",
				"mcp-protocol-version": "2026-07-28",
				"mcp-method": "tools/list",
			}).path,
		).toBe("https://bsvmcp.test/api/mcp");
	});

	test("keeps ordinary markdown and browser requests on page routing", () => {
		expect(rewriteFor("/", "text/markdown").path).toBe(
			"https://bsvmcp.test/md",
		);
		expect(rewriteFor("/", "text/html").path).toBe(null);
	});

	test("rewrites a root CORS preflight for MCP to the handler", () => {
		expect(
			rewriteFor("/", "*/*", "OPTIONS", {
				origin: "https://app.example.com",
				"access-control-request-method": "POST",
				"access-control-request-headers": "authorization, content-type",
			}).path,
		).toBe("https://bsvmcp.test/api/mcp");
	});

	test("leaves an ordinary browser OPTIONS on page routing", () => {
		expect(rewriteFor("/", "text/html", "OPTIONS").path).toBe(null);
		expect(
			rewriteFor("/", "*/*", "OPTIONS", {
				"access-control-request-method": "PUT",
				"access-control-request-headers": "authorization",
			}).path,
		).toBe(null);
	});
});
