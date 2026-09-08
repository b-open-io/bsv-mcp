#!/usr/bin/env bun
import {
	cpSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(process.argv[2] ?? tmpdir());
const build = Bun.spawnSync([process.execPath, "run", "build:all"], {
	cwd: root,
	stdout: "inherit",
	stderr: "inherit",
});
if (build.exitCode !== 0) process.exit(build.exitCode ?? 1);

// Build-time patches are already bundled. Publishing their source manifest
// makes Bun look for these patches in the consumer's project during install.
// Stage a separate manifest so packing never modifies the working checkout.
const stage = mkdtempSync(resolve(tmpdir(), "bsv-mcp-release-"));
try {
	const manifest = JSON.parse(
		readFileSync(resolve(root, "package.json"), "utf8"),
	);
	for (const field of [
		"patchedDependencies",
		"devDependencies",
		"scripts",
		"peerDependencies",
	]) {
		delete manifest[field];
	}
	for (const file of [
		"dist",
		"LICENSE",
		"README.md",
		"CHANGELOG.md",
		"smithery.yaml",
	]) {
		cpSync(resolve(root, file), resolve(stage, file), { recursive: true });
	}
	writeFileSync(
		resolve(stage, "package.json"),
		`${JSON.stringify(manifest, null, 2)}\n`,
	);
	const packed = Bun.spawnSync(
		["npm", "pack", "--ignore-scripts", "--pack-destination", destination],
		{
			cwd: stage,
			stdout: "inherit",
			stderr: "inherit",
		},
	);
	if (packed.exitCode !== 0) throw new Error("Release packing failed");
} finally {
	rmSync(stage, { recursive: true, force: true });
}
