import { describe, expect, test } from "bun:test";
import {
	isMcpCorsPreflight,
	isMcpRequest,
	isModernMcpRequest,
	MODERN_MCP_PROTOCOL_VERSION,
} from "./mcp-request";

function headers(init: Record<string, string>): Headers {
	return new Headers(init);
}

describe("isMcpRequest", () => {
	test("recognises a stateless modern request without a session header", () => {
		const requestHeaders = headers({
			"content-type": "application/json; charset=utf-8",
			"mcp-protocol-version": MODERN_MCP_PROTOCOL_VERSION,
			"mcp-method": "tools/list",
		});

		expect(isModernMcpRequest("POST", requestHeaders)).toBe(true);
		expect(isMcpRequest("POST", requestHeaders)).toBe(true);
	});

	test("recognises modern named calls with the Mcp-Name header", () => {
		expect(
			isMcpRequest(
				"POST",
				headers({
					"content-type": "application/json",
					"mcp-protocol-version": MODERN_MCP_PROTOCOL_VERSION,
					"mcp-method": "tools/call",
					"mcp-name": "proof_echo",
				}),
			),
		).toBe(true);
	});

	test("requires modern POSTs to use the JSON media type", () => {
		const requestHeaders = headers({
			"content-type": "text/plain",
			"mcp-protocol-version": MODERN_MCP_PROTOCOL_VERSION,
			"mcp-method": "tools/list",
		});

		expect(isModernMcpRequest("POST", requestHeaders)).toBe(false);
		// MCP-specific headers still keep malformed traffic at the MCP route so
		// the handler can return its protocol error instead of a page.
		expect(isMcpRequest("POST", requestHeaders)).toBe(true);
	});

	test("does not classify a modern request without its method header", () => {
		expect(
			isModernMcpRequest(
				"POST",
				headers({
					"content-type": "application/json",
					"mcp-protocol-version": MODERN_MCP_PROTOCOL_VERSION,
				}),
			),
		).toBe(false);
	});

	test("recognises a JSON-RPC POST", () => {
		expect(
			isMcpRequest("POST", headers({ "content-type": "application/json" })),
		).toBe(true);
	});

	test("recognises the streamable HTTP accept header", () => {
		expect(
			isMcpRequest(
				"POST",
				headers({ accept: "application/json, text/event-stream" }),
			),
		).toBe(true);
		expect(isMcpRequest("GET", headers({ accept: "text/event-stream" }))).toBe(
			true,
		);
	});

	test("recognises MCP session and protocol headers", () => {
		expect(isMcpRequest("GET", headers({ "mcp-session-id": "abc" }))).toBe(
			true,
		);
		expect(
			isMcpRequest("GET", headers({ "mcp-protocol-version": "2025-11-25" })),
		).toBe(true);
	});

	test("treats DELETE as session termination", () => {
		expect(isMcpRequest("DELETE", headers({}))).toBe(true);
	});

	test("never claims an ordinary browser request", () => {
		const browser =
			"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8";
		expect(isMcpRequest("GET", headers({ accept: browser }))).toBe(false);
		expect(isMcpRequest("GET", headers({ accept: "text/markdown" }))).toBe(
			false,
		);
		expect(isMcpRequest("GET", headers({}))).toBe(false);
		expect(isMcpRequest("HEAD", headers({ accept: "text/html" }))).toBe(false);
	});

	test("does not claim a form post", () => {
		expect(
			isMcpRequest(
				"POST",
				headers({ "content-type": "application/x-www-form-urlencoded" }),
			),
		).toBe(false);
	});

	test("accepts JSON parameters while rejecting lookalike media types", () => {
		expect(
			isMcpRequest(
				"POST",
				headers({ "content-type": "application/json; charset=utf-8" }),
			),
		).toBe(true);
		expect(
			isMcpRequest(
				"POST",
				headers({ "content-type": "application/json-patch+json" }),
			),
		).toBe(false);
	});
});

describe("isMcpCorsPreflight", () => {
	const preflight = (requested: string) =>
		headers({
			origin: "https://app.example.com",
			"access-control-request-method": "POST",
			"access-control-request-headers": requested,
		});

	test("claims a POST preflight that requests MCP or auth headers", () => {
		expect(
			isMcpCorsPreflight("OPTIONS", preflight("authorization, content-type")),
		).toBe(true);
		expect(
			isMcpCorsPreflight(
				"OPTIONS",
				preflight("mcp-protocol-version, mcp-method"),
			),
		).toBe(true);
		expect(isMcpRequest("OPTIONS", preflight("mcp-session-id"))).toBe(true);
	});

	test("recognizes GET and DELETE preflight with authorization", () => {
		for (const method of ["GET", "DELETE"])
			expect(
				isMcpCorsPreflight(
					"OPTIONS",
					headers({
						"access-control-request-method": method,
						"access-control-request-headers": "authorization",
					}),
				),
			).toBe(true);
	});

	test("ignores ordinary browser OPTIONS traffic", () => {
		const browser =
			"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
		expect(isMcpCorsPreflight("OPTIONS", headers({}))).toBe(false);
		expect(isMcpCorsPreflight("OPTIONS", headers({ accept: browser }))).toBe(
			false,
		);
		expect(
			isMcpCorsPreflight(
				"OPTIONS",
				headers({
					"access-control-request-method": "POST",
					"access-control-request-headers": "x-custom-thing",
				}),
			),
		).toBe(false);
		expect(
			isMcpCorsPreflight(
				"OPTIONS",
				headers({
					"access-control-request-method": "PUT",
					"access-control-request-headers": "authorization",
				}),
			),
		).toBe(false);
		expect(isMcpRequest("OPTIONS", headers({ accept: browser }))).toBe(false);
	});
});
