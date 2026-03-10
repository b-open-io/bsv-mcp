/**
 * Custom esbuild script for the Cloudflare Worker.
 *
 * Bundles src/index.ts into dist/index.js with:
 *   - platform: "node" so all node: builtins are treated as external
 *     (CF Workers' nodejs_compat flag provides polyfills at runtime)
 *   - Bun-specific and problematic modules marked external
 *     (never reached at runtime — guarded by disabled tool config flags)
 */
import { build } from "esbuild";

await build({
	entryPoints: ["src/index.ts"],
	bundle: true,
	outfile: "dist/index.js",
	format: "esm",
	target: "es2022",
	// platform: "node" keeps all node:* builtins external.
	// CF Workers with nodejs_compat resolves them at deploy time.
	platform: "node",
	mainFields: ["module", "main"],
	conditions: ["worker", "import"],
	external: [
		// Bun-specific — no CF Workers equivalent
		"bun:sqlite",
		// Module resolution issues at bundle time (type-only usage)
		"@1sat/wallet-remote",
	],
	define: {
		"process.env.NODE_ENV": '"production"',
	},
	logLevel: "info",
});
