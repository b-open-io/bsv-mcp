import { describe, expect, test } from "bun:test";
import { isMcpRequest } from "./mcp-request";

function headers(init: Record<string, string>): Headers {
	return new Headers(init);
}

describe("isMcpRequest", () => {
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
});
