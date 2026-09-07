import { expect, test } from "bun:test";
import { GET } from "../app/.well-known/oauth-authorization-server/route";
import { verifyHostedToken } from "./hosted-auth";
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

test("hosted validation rejects malformed credentials", async () => {
	await expect(verifyHostedToken("not-a-token")).rejects.toThrow();
});
