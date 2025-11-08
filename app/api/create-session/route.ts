import { getCloudflareEnv } from "@/lib/cloudflare";
import { parseAuthToken, verifyAuthToken } from "bitcoin-auth";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		// Access CloudFlare env from the request context
		const env = getCloudflareEnv();

		const authToken = request.headers.get("X-Auth-Token");
		if (!authToken) {
			return NextResponse.json(
				{ error: "Missing auth token" },
				{ status: 401 },
			);
		}

		// Parse the auth token to get the timestamp
		const parsedToken = parseAuthToken(authToken);

		if (!parsedToken) {
			return NextResponse.json(
				{ error: "Invalid auth token format" },
				{ status: 401 },
			);
		}

		// Verify the auth token with the same timestamp from the token
		const isValid = verifyAuthToken(
			authToken,
			{
				requestPath: "/api/create-session",
				timestamp: parsedToken.timestamp,
			},
			600000,
		); // 10 minute time window

		if (!isValid) {
			return NextResponse.json(
				{ error: "Invalid auth token" },
				{ status: 401 },
			);
		}

		// Generate session token
		const sessionToken = crypto.randomUUID();

		// Store session in KV (expires in 30 days)
		await env.SESSIONS.put(sessionToken, authToken, {
			expirationTtl: 2592000,
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
