import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const bundle = resolve("dist/local-mcp-launcher.js");

test("npm package ships a self-contained local launcher bundle", () => {
	if (!existsSync(bundle))
		throw new Error("Run bun run build before checking the launcher artifact");
	const source = readFileSync(bundle, "utf8");
	expect(source.startsWith("#!/usr/bin/env bun")).toBe(true);
	expect(source).toContain("BSV_MCP_PROJECT_ROOT");
	expect(source).toContain("BSV_MCP_PROJECT_ID");
	expect(source).not.toContain('from "../utils/accounts.ts"');
	expect(source).not.toContain('from "./utils/accounts.ts"');
	expect(source).not.toContain('from "./local-mcp-launcher"');
});

test("bundled launcher runs from dist without a source checkout", async () => {
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
