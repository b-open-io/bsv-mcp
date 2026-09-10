import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const bundle = resolve("dist/local-mcp-launcher.js");

function ensureLauncherBundle(): void {
	if (existsSync(bundle)) return;
	const build = Bun.spawnSync([process.execPath, "run", "build"], {
		stdout: "inherit",
		stderr: "inherit",
	});
	if (build.exitCode !== 0)
		throw new Error("bun run build failed; cannot check the launcher artifact");
}

test("npm package ships a self-contained local launcher bundle", () => {
	ensureLauncherBundle();
	const source = readFileSync(bundle, "utf8");
	expect(source.startsWith("#!/usr/bin/env bun")).toBe(true);
	expect(source).toContain("BSV_MCP_PROJECT_ROOT");
	expect(source).toContain("BSV_MCP_PROJECT_ID");
	expect(source).not.toContain('from "../utils/accounts.ts"');
	expect(source).not.toContain('from "./utils/accounts.ts"');
	expect(source).not.toContain('from "./local-mcp-launcher"');
});

test("bundled launcher runs from dist without a source checkout", async () => {
	ensureLauncherBundle();
	const child = Bun.spawn([process.execPath, bundle, "--help"], {
		cwd: tmpdir(),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [exitCode, stderr] = await Promise.all([
		child.exited,
		new Response(child.stderr).text(),
	]);
	expect(exitCode).toBe(0);
	expect(stderr).toContain("--project-root");
	expect(stderr).toContain("--project-id");
});
