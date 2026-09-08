import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
	MCP_PRIMARY_PROTOCOL,
	readMcpProtocolPolicy,
} from "../utils/mcpProtocol";
import {
	getAppVersion,
	MCP_ENDPOINT,
	MCP_ENDPOINT_LEGACY,
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

	test("protocol facts match the serving policy", () => {
		// Site metadata must reflect the actual modern-first serving policy.
		expect(MCP_PROTOCOL_LATEST).toBe(MCP_PRIMARY_PROTOCOL);
		expect(MCP_PROTOCOL_SUPPORTED).toEqual(
			readMcpProtocolPolicy().supportedVersions,
		);
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

	test("mcp endpoint is the site origin, with nothing to append", () => {
		// The root serves the landing page to browsers and the MCP server to
		// MCP clients, so the connection URL is just the domain.
		expect(MCP_ENDPOINT).toBe(SITE_URL);
		expect(MCP_ENDPOINT.endsWith("/api/mcp")).toBe(false);
	});

	test("the original endpoint is still published for existing clients", () => {
		expect(MCP_ENDPOINT_LEGACY).toBe(`${SITE_URL}/api/mcp`);
	});
});

describe("oauth scopes", () => {
	test("every scope carries a description for humans", () => {
		for (const scope of OAUTH_SCOPES) {
			expect(scope.description.length).toBeGreaterThan(0);
		}
	});

	test("declares the supported identity scopes", () => {
		for (const name of ["openid", "profile", "email", "offline_access"]) {
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
