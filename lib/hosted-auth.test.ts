import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { GET } from "../app/.well-known/oauth-authorization-server/route";
import { OAUTH_SCOPE_NAMES } from "./site";

test("hosted discovery advertises the issuer's supported scopes", async () => {
	const metadata = await (await GET()).json();
	expect(metadata.scopes_supported).toEqual(OAUTH_SCOPE_NAMES);
	expect(metadata.scopes_supported).toEqual([
		"openid",
		"profile",
		"email",
		"offline_access",
	]);
	expect(metadata.code_challenge_methods_supported).toEqual(["S256"]);
});

test("hosted validation uses the Better Auth userinfo endpoint", () => {
	const route = readFileSync(
		new URL("../app/api/mcp/route.ts", import.meta.url),
		"utf8",
	);
	expect(route).toContain("/api/auth/oauth2/userinfo");
	expect(route).not.toContain("await response.text()");
});
