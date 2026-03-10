import { parseAuthToken, verifyAuthToken } from "bitcoin-auth";
import { type NextRequest, NextResponse } from "next/server";

// In-memory session store. For production, replace with Redis/DB.
// Sessions map: token -> { authToken, expiresAt }
const sessions = new Map<string, { authToken: string; expiresAt: number }>();

// Prune expired sessions periodically
function pruneExpiredSessions() {
	const now = Date.now();
	for (const [token, session] of sessions) {
		if (session.expiresAt < now) {
			sessions.delete(token);
		}
	}
}

export async function POST(request: NextRequest) {
	try {
		const authToken = request.headers.get("X-Auth-Token");
		if (!authToken) {
			return NextResponse.json(
				{ error: "Missing X-Auth-Token header" },
				{ status: 401 },
			);
		}

		const parsedToken = parseAuthToken(authToken);
		if (!parsedToken) {
			return NextResponse.json(
				{ error: "Invalid auth token format" },
				{ status: 401 },
			);
		}

		// Verify the signature with a 10-minute time window
		const isValid = verifyAuthToken(
			authToken,
			{
				requestPath: "/api/create-session",
				timestamp: parsedToken.timestamp,
			},
			600_000,
		);

		if (!isValid) {
			return NextResponse.json(
				{ error: "Invalid auth token signature" },
				{ status: 401 },
			);
		}

		pruneExpiredSessions();

		const sessionToken = crypto.randomUUID();
		const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
		sessions.set(sessionToken, {
			authToken,
			expiresAt: Date.now() + TTL_MS,
		});

		return NextResponse.json({ sessionToken });
	} catch (error) {
		console.error("Session creation error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * Validate a session token. Used by the MCP route middleware.
 */
export function validateSession(token: string): boolean {
	const session = sessions.get(token);
	if (!session) return false;
	if (session.expiresAt < Date.now()) {
		sessions.delete(token);
		return false;
	}
	return true;
}
