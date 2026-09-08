import { expect, test } from "bun:test";
import type { AuthInfo } from "@modelcontextprotocol/server";
import {
	ANONYMOUS_MCP_SESSION_PRINCIPAL,
	getMcpSessionPrincipal,
	isMcpSessionPrincipalMatch,
} from "./mcpSessionPrincipal";

function authInfo(
	clientId: string,
	userId: string,
	token = "token-1",
): AuthInfo {
	return {
		token,
		clientId,
		scopes: ["bsv:tools"],
		expiresAt: 1_000,
		extra: { userId },
	};
}

test("binds a session to the verified user identity, not the bearer token", () => {
	const original = authInfo("client-a", "user-a", "token-1");
	const refreshed = authInfo("client-a", "user-a", "token-2");

	const boundPrincipal = getMcpSessionPrincipal(original);

	expect(boundPrincipal).toBe("user:user-a");
	expect(isMcpSessionPrincipalMatch(boundPrincipal, refreshed)).toBe(true);
});

test("rejects a different verified user for the same session", () => {
	const boundPrincipal = getMcpSessionPrincipal(authInfo("client-a", "user-a"));

	expect(
		isMcpSessionPrincipalMatch(
			boundPrincipal,
			authInfo("client-a", "user-b", "token-attacker"),
		),
	).toBe(false);
});

test("preserves surrounding whitespace in distinct verified identities", () => {
	const ordinaryUser = getMcpSessionPrincipal(authInfo("client-a", "user-a"));
	const whitespaceUser = getMcpSessionPrincipal(
		authInfo("client-a", " user-a "),
	);

	expect(ordinaryUser).toBe("user:user-a");
	expect(whitespaceUser).toBe("user: user-a ");
	expect(
		isMcpSessionPrincipalMatch(ordinaryUser, authInfo("client-a", " user-a ")),
	).toBe(false);

	const ordinaryClient = getMcpSessionPrincipal({ clientId: "client-a" });
	const whitespaceClient = getMcpSessionPrincipal({ clientId: " client-a " });

	expect(ordinaryClient).toBe("client:client-a");
	expect(whitespaceClient).toBe("client: client-a ");
	expect(
		isMcpSessionPrincipalMatch(ordinaryClient, { clientId: " client-a " }),
	).toBe(false);
});

test("keeps whitespace-only verified users distinct from each other and anonymous", () => {
	const space = authInfo("client-a", " ");
	const tab = authInfo("client-a", "\t");
	const bound = getMcpSessionPrincipal(space);

	expect(bound).toBe("user: ");
	expect(getMcpSessionPrincipal(tab)).toBe("user:\t");
	expect(isMcpSessionPrincipalMatch(bound, tab)).toBe(false);
	expect(isMcpSessionPrincipalMatch(bound, space)).toBe(true);
	expect(isMcpSessionPrincipalMatch(bound)).toBe(false);
	expect(
		isMcpSessionPrincipalMatch(ANONYMOUS_MCP_SESSION_PRINCIPAL, space),
	).toBe(false);
});

test("keeps whitespace-only verified clients distinct from each other and anonymous", () => {
	const space = { clientId: " " };
	const tab = { clientId: "\t" };
	const bound = getMcpSessionPrincipal(space);

	expect(bound).toBe("client: ");
	expect(getMcpSessionPrincipal(tab)).toBe("client:\t");
	expect(isMcpSessionPrincipalMatch(bound, tab)).toBe(false);
	expect(isMcpSessionPrincipalMatch(bound, space)).toBe(true);
	expect(isMcpSessionPrincipalMatch(bound)).toBe(false);
	expect(
		isMcpSessionPrincipalMatch(ANONYMOUS_MCP_SESSION_PRINCIPAL, space),
	).toBe(false);
});

test("falls back to clientId when AuthInfo has no userId", () => {
	const first = {
		token: "token-1",
		clientId: "client-a",
		scopes: [],
	} satisfies AuthInfo;
	const refreshed = {
		token: "token-2",
		clientId: "client-a",
		scopes: ["bsv:tools"],
	} satisfies AuthInfo;

	const boundPrincipal = getMcpSessionPrincipal(first);

	expect(boundPrincipal).toBe("client:client-a");
	expect(isMcpSessionPrincipalMatch(boundPrincipal, refreshed)).toBe(true);
	expect(
		isMcpSessionPrincipalMatch(boundPrincipal, {
			...refreshed,
			clientId: "client-b",
		}),
	).toBe(false);
});

test("uses one anonymous principal when authentication is absent", () => {
	expect(getMcpSessionPrincipal()).toBe(ANONYMOUS_MCP_SESSION_PRINCIPAL);
	expect(isMcpSessionPrincipalMatch(ANONYMOUS_MCP_SESSION_PRINCIPAL)).toBe(
		true,
	);
	expect(
		isMcpSessionPrincipalMatch(
			ANONYMOUS_MCP_SESSION_PRINCIPAL,
			authInfo("client-a", "user-a"),
		),
	).toBe(false);
});
