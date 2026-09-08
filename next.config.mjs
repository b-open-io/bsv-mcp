/** @type {import('next').NextConfig} */
const nextConfig = {
	// Keep Next's workspace boundary at this repository when the parent folder
	// contains unrelated package managers or lockfiles.
	turbopack: {
		root: process.cwd(),
	},
	typescript: {
		ignoreBuildErrors: true,
	},
	images: {
		unoptimized: true,
	},
	// Every negotiated response must vary on Accept, otherwise a CDN can hand a
	// cached HTML variant to an agent that asked for markdown. Middleware cannot
	// set this reliably: Next rewrites Vary on RSC-capable page responses after
	// proxy runs, so it is declared here instead.
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [{ key: "Vary", value: "Accept" }],
			},
		];
	},
	// Stable `.md` aliases preserve document URLs while proxy negotiates the
	// representation from the Accept header.
	async rewrites() {
		return [
			// Proxy handles content negotiation first. These destinations keep the
			// aliases usable if a deployment bypasses proxy for a static request.
			{ source: "/index.md", destination: "/" },
			{ source: "/connect.md", destination: "/connect" },
			{ source: "/docs.md", destination: "/docs" },
		];
	},
	// Next.js 16 uses Turbopack by default in development
	// No experimental.turbopack needed
};

export default nextConfig;
