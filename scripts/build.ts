#!/usr/bin/env bun
/**
 * Build script — bundles index.ts into dist/index.js with stdio guard banner.
 */

const OUTFILE = "./dist/index.js";

// The stdio guard MUST run before any bundled module initializes,
// so we prepend it as a banner. Bun's bundler hoists module shims
// before user code, which is why inline guard in index.ts isn't enough for the bundle.
const STDIO_GUARD = `\
var __isStdio = process.argv.includes("--stdio") || (process.env.TRANSPORT || "").toLowerCase() === "stdio";
if (__isStdio) {
  var __err = console.error.bind(console);
  console.log = function() { __err.apply(null, ["[log]"].concat([].slice.call(arguments))); };
  console.warn = function() { __err.apply(null, ["[warn]"].concat([].slice.call(arguments))); };
  console.info = function() { __err.apply(null, ["[info]"].concat([].slice.call(arguments))); };
  console.debug = function() { __err.apply(null, ["[debug]"].concat([].slice.call(arguments))); };
}
`;

// knex ships every SQL dialect and require()s that dialect's driver at module
// scope. @bsv/wallet-toolbox pulls knex in for SQLite alone, so the remaining
// drivers are never installed and the bundler cannot resolve them. They stay
// external; nothing reaches them at runtime.
const UNUSED_KNEX_DRIVERS = [
	"pg",
	"pg-query-stream",
	"mysql",
	"mysql2",
	"mariadb",
	"mariadb/callback",
	"oracledb",
	"tedious",
	"better-sqlite3",
	"sqlite3",
];

console.log("Building bundle...");
const result = Bun.spawnSync(
	[
		"bun",
		"build",
		"./index.ts",
		"--target=node",
		`--outfile=${OUTFILE}`,
		`--banner=${STDIO_GUARD}`,
		...UNUSED_KNEX_DRIVERS.flatMap((driver) => ["--external", driver]),
	],
	{ stdout: "inherit", stderr: "inherit" },
);
if (result.exitCode !== 0) {
	process.stderr.write(`Build failed with exit code ${result.exitCode}\n`);
	process.exit(result.exitCode ?? 1);
}

const { size } = Bun.file(OUTFILE);
console.log(`Bundle: ${OUTFILE} (${(size / 1024 / 1024).toFixed(1)} MB)`);
