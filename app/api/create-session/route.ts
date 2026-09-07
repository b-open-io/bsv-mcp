import { NextResponse } from "next/server";

// Retired key-based onboarding. Never accept credentials or issue local tokens.
export async function POST() {
	return NextResponse.json(
		{
			error:
				"This login flow has been retired. Connect through your MCP client using OAuth. See /connect.",
		},
		{ status: 410, headers: { "Cache-Control": "no-store" } },
	);
}
