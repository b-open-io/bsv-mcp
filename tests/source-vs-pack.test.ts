import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

test("git ignores the generated bundle; npm pack still ships it", () => {
	const ignored = Bun.spawnSync(
		["git", "-C", root, "check-ignore", "-q", "--no-index", "dist/index.js"],
		{ stdout: "pipe", stderr: "pipe" },
	);
	expect(ignored.exitCode).toBe(0);

	const tracked = Bun.spawnSync(
		["git", "-C", root, "ls-files", "--error-unmatch", "dist/index.js"],
		{ stdout: "pipe", stderr: "pipe" },
	);
	expect(tracked.exitCode).not.toBe(0);

	const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
		files: string[];
		scripts: Record<string, string>;
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
	expect(pkg.files.some((entry) => entry.startsWith("dist/"))).toBe(true);
	expect(pkg.scripts.prepack).toContain("build:all");
	expect(pkg.scripts["pack:release"]).toBeUndefined();
	expect(pkg.dependencies ?? {}).toEqual({});
	expect(pkg.devDependencies?.["@opl.dev/vault"]).toBeTruthy();
	expect(pkg.devDependencies?.["bitcoin-backup"]).toBeTruthy();
});
