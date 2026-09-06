import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
	LATEST_PROTOCOL_VERSION,
	SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/sdk/types.js";
import {
	getAppVersion,
	MCP_ENDPOINT,
	MCP_PROTOCOL_LATEST,
	MCP_PROTOCOL_SUPPORTED,
	OAUTH_SCOPE_NAMES,
	OAUTH_SCOPES,
	SITE_URL,
} from "./site";

describe("version and protocol facts", () => {
	test("app version matches package.json", () => {
		const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
			version: string;
		};
		expect(getAppVersion()).toBe(pkg.version);
	});

	test("protocol version comes from the SDK, not a literal", () => {
		// The badge previously hardcoded 2025-03-26, which went stale.
		expect(MCP_PROTOCOL_LATEST).toBe(LATEST_PROTOCOL_VERSION);
		expect(MCP_PROTOCOL_SUPPORTED).toEqual([...SUPPORTED_PROTOCOL_VERSIONS]);
		expect(MCP_PROTOCOL_SUPPORTED).toContain(MCP_PROTOCOL_LATEST);
	});

	test("protocol version looks like a spec revision date", () => {
		expect(MCP_PROTOCOL_LATEST).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("urls", () => {
	test("site url has no trailing slash", () => {
		expect(SITE_URL.endsWith("/")).toBe(false);
	});

	test("mcp endpoint is derived from the site url", () => {
		expect(MCP_ENDPOINT).toBe(`${SITE_URL}/api/mcp`);
	});
});

describe("oauth scopes", () => {
	test("every scope carries a description for humans", () => {
		for (const scope of OAUTH_SCOPES) {
			expect(scope.description.length).toBeGreaterThan(0);
		}
	});

	test("declares the bsv-specific least-privilege scopes", () => {
		for (const name of [
			"bsv:tools",
			"bsv:wallet",
			"bsv:ordinals",
			"bsv:tokens",
		]) {
			expect(OAUTH_SCOPE_NAMES).toContain(name);
		}
	});

	test("scope names are unique", () => {
		expect(new Set(OAUTH_SCOPE_NAMES).size).toBe(OAUTH_SCOPE_NAMES.length);
	});
});

describe("site url independence", () => {
	test("does not inherit the OAuth resource identifier", () => {
		// RESOURCE_URL names the protected resource for token validation and
		// currently points at an older hostname; the public site must not
		// silently adopt it.
		const previous = process.env.RESOURCE_URL;
		process.env.RESOURCE_URL = "https://example.invalid";
		try {
			expect(SITE_URL).not.toContain("example.invalid");
		} finally {
			if (previous === undefined) delete process.env.RESOURCE_URL;
			else process.env.RESOURCE_URL = previous;
		}
	});
});
