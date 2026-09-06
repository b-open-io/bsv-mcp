/** @type {import('next').NextConfig} */
const nextConfig = {
	typescript: {
		ignoreBuildErrors: true,
	},
	images: {
		unoptimized: true,
	},
	// Every negotiated response must vary on Accept, otherwise a CDN can hand a
	// cached HTML variant to an agent that asked for markdown. Middleware cannot
	// set this reliably: Next rewrites Vary on RSC-capable page responses after
	// middleware runs, so it is declared here instead.
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [{ key: "Vary", value: "Accept" }],
			},
		];
	},
	// Stable `.md` URLs for the markdown renderings, so agents can link to a
	// specific document without relying on Accept negotiation.
	async rewrites() {
		return [
			{ source: "/index.md", destination: "/md" },
			{ source: "/connect.md", destination: "/md/connect" },
		];
	},
	// Next.js 16 uses Turbopack by default in development
	// No experimental.turbopack needed
};

export default nextConfig;
