/** @type {import('next').NextConfig} */
const nextConfig = {
	typescript: {
		ignoreBuildErrors: true,
	},
	images: {
		unoptimized: true,
	},
	// Next.js 16 uses Turbopack by default in development
	// No experimental.turbopack needed
};

export default nextConfig;
