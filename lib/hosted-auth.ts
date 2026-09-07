import { verifyBearerToken } from "better-auth/oauth2";
import { AUTH_SERVER_URL, MCP_ENDPOINT } from "./site";

export function verifyHostedToken(token: string) {
	return verifyBearerToken(token, {
		jwksUrl: `${AUTH_SERVER_URL}/api/auth/jwks`,
		verifyOptions: {
			issuer: AUTH_SERVER_URL,
			audience: MCP_ENDPOINT,
			requiredClaims: ["iss", "aud", "exp", "sub"],
		},
	});
}
