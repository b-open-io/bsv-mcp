/**
 * stdio Guard - redirects all console.log/warn/debug/info to stderr
 * when running in stdio transport mode.
 *
 * The MCP stdio transport uses stdout exclusively for JSON-RPC messages.
 * Any non-JSON-RPC bytes on stdout (log output, debug info, etc.) corrupt
 * the protocol and prevent clients like Claude Desktop from seeing any tools.
 *
 * This module MUST be loaded before any dependency that calls console.log.
 * In source mode: use Bun's --preload flag (see start.sh).
 * In bundle mode: this code is injected at the top of build/server.js.
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

	// biome-ignore lint/suspicious/noConsole: intentional redirect
	console.log = (...args: unknown[]) => err("[log]", ...args);
	// biome-ignore lint/suspicious/noConsole: intentional redirect
	console.warn = (...args: unknown[]) => err("[warn]", ...args);
	// biome-ignore lint/suspicious/noConsole: intentional redirect
	console.info = (...args: unknown[]) => err("[info]", ...args);
	// biome-ignore lint/suspicious/noConsole: intentional redirect
	console.debug = (...args: unknown[]) => err("[debug]", ...args);
}
