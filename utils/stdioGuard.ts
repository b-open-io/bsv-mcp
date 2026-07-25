/**
 * stdio Guard - redirects all console.log/warn/debug/info to stderr
 * when running in stdio transport mode.
 *
 * The MCP stdio transport uses stdout exclusively for JSON-RPC messages.
 * Any non-JSON-RPC bytes on stdout (log output, debug info, etc.) corrupt
 * the protocol and prevent clients like Claude Desktop from seeing any tools.
 *
 * This module MUST initialize before any dependency that calls console.log, so
 * index.ts imports it first: ES imports evaluate in order, ahead of any
 * top-level statement in the importing module.
 *
 * The bundle cannot rely on that ordering — Bun hoists module shims above user
 * code — so scripts/build.ts prepends an equivalent guard as a banner.
 *
 * Only stdio mode is affected. HTTP transport mode is unchanged.
 */

const isStdio =
	process.argv.includes("--stdio") ||
	process.env.TRANSPORT?.toLowerCase() === "stdio";

if (isStdio) {
	// Redirect every console method that writes to stdout → stderr.
	// console.error already goes to stderr — leave it alone.
	const err = console.error.bind(console);

	console.log = (...args: unknown[]) => err("[log]", ...args);
	console.warn = (...args: unknown[]) => err("[warn]", ...args);
	console.info = (...args: unknown[]) => err("[info]", ...args);
	console.debug = (...args: unknown[]) => err("[debug]", ...args);
}
