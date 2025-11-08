import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const { pubkey, address } = await request.json();

		if (!pubkey && !address) {
			return NextResponse.json(
				{ error: "Public key or address is required" },
				{ status: 400 },
			);
		}

		// Generate a simple challenge using BigBlocks pattern
		const challenge = `bsv-mcp-${Date.now()}-${Math.random().toString(36).substring(2)}`;
		const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

		return NextResponse.json({
			challenge,
			expires,
			success: true,
		});
	} catch (error) {
		console.error("Challenge generation error:", error);
		return NextResponse.json(
			{ error: "Failed to generate challenge" },
			{ status: 500 },
		);
	}
}

export async function GET() {
	return NextResponse.json({
		message: "Auth challenge endpoint",
		method: "POST",
		required: ["pubkey"],
	});
}
