import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "..");
const uiDirectory = join(repositoryRoot, "dist", "local-ui");
const uiEntry = join(uiDirectory, "index.html");

type PackedFile = { path: string };
type PackResult = { files: PackedFile[] };

function walkFiles(directory: string): string[] {
	if (!existsSync(directory)) return [];
	const files: string[] = [];
	for (const name of readdirSync(directory)) {
		const path = join(directory, name);
		if (statSync(path).isDirectory()) files.push(...walkFiles(path));
		else files.push(path);
	}
	return files;
}

async function npmPackPreview(): Promise<PackResult> {
	const process = Bun.spawn(
		["npm", "pack", "--dry-run", "--json", "--silent"],
		{ cwd: repositoryRoot, stdout: "pipe", stderr: "pipe" },
	);
	const [exitCode, stdout, stderr] = await Promise.all([
		process.exited,
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
	]);
	if (exitCode !== 0)
		throw new Error(`npm pack failed (${exitCode}): ${stderr || stdout}`);
	const start = stdout.search(/\[\s*\{\s*"id"\s*:/s);
	if (start < 0)
		throw new Error(`npm pack returned no JSON metadata: ${stdout}`);
	const metadata = JSON.parse(stdout.slice(start)) as PackResult[];
	if (!metadata[0]) throw new Error("npm pack returned an empty result");
	return metadata[0];
}

function assetReferences(html: string): string[] {
	const references: string[] = [];
	for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
		const reference = match[1];
		if (
			reference &&
			(reference.startsWith("./assets/") ||
				reference.startsWith("/assets/") ||
				reference.startsWith("assets/"))
		)
			references.push(reference.replace(/^\.\//, "").replace(/^\//, ""));
	}
	return references;
}

test("npm artifact ships the modular local UI and every referenced asset", async () => {
	const packageJson = JSON.parse(
		readFileSync(join(repositoryRoot, "package.json"), "utf8"),
	) as {
		dependencies?: Record<string, string>;
	};
	expect(packageJson.dependencies?.next).toBeUndefined();

	const packed = await npmPackPreview();
	const packedPaths = new Set(packed.files.map((file) => file.path));
	expect(packedPaths.has("dist/index.js")).toBe(true);
	expect(packedPaths.has("dist/local-mcp-launcher.js")).toBe(true);
	expect(packedPaths.has("dist/local-ui/index.html")).toBe(true);

	const uiFiles = walkFiles(uiDirectory);
	expect(uiFiles.length).toBeGreaterThan(1);
	for (const file of uiFiles) {
		expect(packedPaths.has(relative(repositoryRoot, file))).toBe(true);
	}

	const html = readFileSync(uiEntry, "utf8");
	const references = assetReferences(html);
	expect(references.length).toBeGreaterThan(0);
	for (const reference of references)
		expect(packedPaths.has(`dist/local-ui/${reference}`)).toBe(true);

	for (const path of packedPaths) {
		expect(path.startsWith(".next/")).toBe(false);
		expect(path.startsWith("app/")).toBe(false);
		expect(path.startsWith("node_modules/")).toBe(false);
	}
});
