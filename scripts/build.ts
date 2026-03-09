#!/usr/bin/env bun
/**
 * Build script that bundles index.ts and injects the stdio guard at the top.
 *
 * The stdio guard redirects console.log/warn/info/debug to stderr when running
 * in stdio mode, preventing stdout pollution that would corrupt the MCP protocol.
 * It must execute before any dependency module is initialized, so it must be
 * the first code that runs in the bundle — before any __commonJS factory call.
 */

import { readFileSync, writeFileSync } from "node:fs";

const OUTFILE = "./build/server.js";

// Step 1: Run bun build
console.log("Building bundle...");
const result = Bun.spawnSync(
	["bun", "build", "./index.ts", "--target=node", `--outfile=${OUTFILE}`],
	{ stdout: "inherit", stderr: "inherit" },
);
if (result.exitCode !== 0) {
	process.stderr.write(`Build failed with exit code ${result.exitCode}\n`);
	process.exit(result.exitCode ?? 1);
}

// Step 2: Inject stdio guard after __require declaration (before first node_modules section)
const GUARD = `
// --- stdio guard: redirect console.log/warn/info/debug to stderr in stdio mode ---
// Must run before any dependency module is initialized so no stdout pollution
// corrupts the JSON-RPC protocol used by the MCP stdio transport.
(function() {
  var isStdio = process.argv.includes("--stdio") || (process.env.TRANSPORT || "").toLowerCase() === "stdio";
  if (isStdio) {
    function fmtArgs(args) {
      return Array.prototype.slice.call(args).map(function(a) {
        return typeof a === "string" ? a : JSON.stringify(a);
      }).join(" ");
    }
    console.log = function() { process.stderr.write("[log] " + fmtArgs(arguments) + "\\n"); };
    console.warn = function() { process.stderr.write("[warn] " + fmtArgs(arguments) + "\\n"); };
    console.info = function() { process.stderr.write("[info] " + fmtArgs(arguments) + "\\n"); };
    console.debug = function() { process.stderr.write("[debug] " + fmtArgs(arguments) + "\\n"); };
  }
})();
// --- end stdio guard ---
`;

const content = readFileSync(OUTFILE, "utf-8");

// Find injection point: right after the __require declaration line
const MARKER = "var __require = /* @__PURE__ */ createRequire(import.meta.url);";
const idx = content.indexOf(MARKER);
if (idx === -1) {
	process.stderr.write(
		"ERROR: Could not find __require injection point in bundle. Guard not injected.\n",
	);
	process.exit(1);
}

const injectionPoint = idx + MARKER.length;
const patched = content.slice(0, injectionPoint) + GUARD + content.slice(injectionPoint);

writeFileSync(OUTFILE, patched);
console.log(`stdio guard injected into ${OUTFILE}`);
console.log(`Bundle size: ${(patched.length / 1024 / 1024).toFixed(1)} MB`);
