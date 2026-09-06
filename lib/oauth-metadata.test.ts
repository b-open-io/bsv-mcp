import { describe, expect, test } from "bun:test";
import {
	MCP_RESOURCE_PATH,
	protectedResourceMetadata,
	RESOURCE_METADATA_PATH,
} from "./oauth-metadata";
import { MCP_ENDPOINT, OAUTH_SCOPE_NAMES, SITE_URL } from "./site";

describe("protected resource metadata", () => {
	const metadata = protectedResourceMetadata(SITE_URL);

	test("identifies the MCP endpoint, which is the site origin", () => {
		// Clients send this exact URI as the RFC 8707 resource parameter, and
		// the endpoint is now the origin itself.
		expect(metadata.resource).toBe(MCP_ENDPOINT);
		expect(metadata.resource).toBe(SITE_URL);
	});

	test("declares scopes and bearer usage", () => {
		expect(metadata.scopes_supported).toEqual(OAUTH_SCOPE_NAMES);
		expect(metadata.bearer_methods_supported).toEqual(["header"]);
	});

	test("names one authorization server", () => {
		expect(metadata.authorization_servers.length).toBe(1);
		expect(metadata.authorization_servers[0]?.startsWith("https://")).toBe(
			true,
		);
	});

	test("a path-less resource takes the bare well-known path", () => {
		// RFC 9728 inserts the resource path into the well-known URL. The
		// resource is the origin, so there is no path to insert.
		expect(RESOURCE_METADATA_PATH).toBe(
			"/.well-known/oauth-protected-resource",
		);
	});

	test("the legacy endpoint path is still known", () => {
		// Its suffixed metadata stays served for clients configured on it.
		expect(MCP_RESOURCE_PATH).toBe("api/mcp");
	});

	test("uses the caller's origin so previews describe themselves", () => {
		const preview = protectedResourceMetadata("https://preview.example.com");
		expect(preview.resource).toBe("https://preview.example.com");
	});
});
