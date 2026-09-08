import { afterEach, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { localUiAssetsDirectory, readLocalUiAsset } from "./localUiAssets";
import { startVaultSetup } from "./vaultSetup";

const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});
function fixture() {
	const root = mkdtempSync(join(tmpdir(), "local-ui-assets-"));
	roots.push(root);
	mkdirSync(join(root, "assets"));
	writeFileSync(
		join(root, "index.html"),
		'<div id="root"></div><script type="module" src="/assets/app.js"></script>',
	);
	writeFileSync(
		join(root, "assets", "app.js"),
		'document.title="Local setup";',
	);
	writeFileSync(join(root, "assets", "app.css"), "body {color: white}");
	return root;
}
test("serves React entry and assets with correct MIME and preserved local API authentication", async () => {
	const root = fixture();
	const setup = await startVaultSetup({
		assetsDirectory: root,
		inspect: () => ({
			sources: [],
			vaultExists: false,
			environmentKeys: { payment: false, identity: false, empty: true },
			migrationRequired: false,
		}),
	});
	try {
		const url = new URL(setup.url);
		const page = await fetch(url.origin);
		expect(page.status).toBe(200);
		expect(page.headers.get("content-type")).toContain("text/html");
		expect(page.headers.get("content-security-policy")).toContain(
			"script-src 'self'",
		);
		expect(page.headers.get("content-security-policy")).not.toContain(
			"unsafe-inline",
		);
		expect(await page.text()).not.toContain(url.hash.slice(1));
		const script = await fetch(`${url.origin}/assets/app.js`);
		expect(script.headers.get("content-type")).toContain("text/javascript");
		expect(await script.text()).toContain("Local setup");
		const style = await fetch(`${url.origin}/assets/app.css`);
		expect(style.headers.get("content-type")).toContain("text/css");
		expect((await fetch(`${url.origin}/api/inventory`)).status).toBe(403);
		expect(
			(
				await fetch(`${url.origin}/api/inventory`, {
					headers: { Authorization: `Bearer ${url.hash.slice(1)}` },
				})
			).status,
		).toBe(200);
		expect(
			(
				await fetch(`${url.origin}/assets/app.js`, {
					headers: { Origin: "https://evil.example" },
				})
			).status,
		).toBe(403);
		expect(
			(await fetch(`${url.origin}/assets/app.js`, { method: "POST" })).status,
		).toBe(405);
		expect(
			(
				await fetch(`${url.origin}/assets/app.js`, { method: "HEAD" })
			).headers.get("content-length"),
		).toBeTruthy();
	} finally {
		await setup.close();
	}
});
test("rejects traversal, hidden files, unsupported extensions and symlinks outside build", () => {
	const root = fixture();
	const outside = join(root, "..", `${root.split("/").at(-1)}-outside.js`);
	writeFileSync(outside, "secret");
	try {
		symlinkSync(outside, join(root, "assets", "escape.js"));
		for (const path of [
			"/assets/../index.html",
			"/assets/%2e%2e/index.html",
			"/assets/.secret.js",
			"/assets/escape.js",
			"/assets/app.map",
			"/index.html",
		])
			expect(readLocalUiAsset(path, root)).toBeUndefined();
	} finally {
		rmSync(outside, { force: true });
	}
});
test("resolves source and bundled layouts without using cwd", () => {
	const root = fixture();
	const build = join(root, "dist", "local-ui");
	mkdirSync(build, { recursive: true });
	writeFileSync(join(build, "index.html"), "React");
	expect(
		localUiAssetsDirectory(
			pathToFileURL(join(root, "utils", "localUiAssets.ts")).href,
		),
	).toBe(build);
	expect(
		localUiAssetsDirectory(pathToFileURL(join(root, "dist", "index.js")).href),
	).toBe(build);
});
test("returns an explicit unavailable response for a missing packaged build", async () => {
	const root = fixture();
	const setup = await startVaultSetup({
		assetsDirectory: join(root, "missing"),
	});
	try {
		const page = await fetch(new URL(setup.url).origin);
		expect(page.status).toBe(503);
		expect(await page.text()).toContain("Rebuild or reinstall");
	} finally {
		await setup.close();
	}
});
