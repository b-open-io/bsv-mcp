import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Counts the MCP tools this server registers by reading the `tools/` sources.
 *
 * The landing page renders these numbers, so the copy tracks the codebase
 * instead of a hand-maintained figure that drifts as tools are added.
 * Everything here runs at build time in a server component.
 */

const TOOLS_DIR = join(process.cwd(), "tools");

/** Matches `server.tool(` and `server.registerTool(`, the two registration calls. */
const REGISTRATION = /\bserver\s*\.\s*(?:registerTool|tool)\s*\(/g;

/** Categories that are not registered by default, so they stay out of the totals. */
const DEFAULT_DISABLED = new Set(["a2b"]);

function collectSourceFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectSourceFiles(path));
		} else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
			files.push(path);
		}
	}
	return files;
}

function countRegistrations(dir: string): number {
	return collectSourceFiles(dir).reduce((total, file) => {
		const matches = readFileSync(file, "utf8").match(REGISTRATION);
		return total + (matches?.length ?? 0);
	}, 0);
}

export interface ToolCounts {
	/** Tools registered by default, summed across every enabled category. */
	total: number;
	/** Registered tools keyed by their `tools/` directory name. */
	byDirectory: Record<string, number>;
}

let cached: ToolCounts | null = null;

export function getToolCounts(): ToolCounts {
	if (cached) return cached;

	const byDirectory: Record<string, number> = {};
	let total = 0;

	try {
		for (const entry of readdirSync(TOOLS_DIR, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const count = countRegistrations(join(TOOLS_DIR, entry.name));
			byDirectory[entry.name] = count;
			if (!DEFAULT_DISABLED.has(entry.name)) total += count;
		}
	} catch {
		// Sources unavailable (for example a deploy that ships only the app).
		// Callers fall back to copy that carries no number.
	}

	cached = { total, byDirectory };
	return cached;
}

/** Sums the tools in the given `tools/` directories, ignoring unknown names. */
export function countTools(
	counts: ToolCounts,
	directories: readonly string[],
): number {
	return directories.reduce(
		(total, dir) => total + (counts.byDirectory[dir] ?? 0),
		0,
	);
}

/**
 * Renders a total as an approximate floor, so the headline reads "90+" rather
 * than a precise figure that invites nitpicking. Returns null below one bucket.
 */
export function approximateTotal(total: number, bucket = 10): string | null {
	const floored = Math.floor(total / bucket) * bucket;
	return floored >= bucket ? `${floored}+` : null;
}
