import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const types: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
};

/** Resolve the packaged UI from source modules or the bundled CLI, never cwd. */
export function localUiAssetsDirectory(moduleUrl = import.meta.url): string {
	const here = dirname(fileURLToPath(moduleUrl));
	const candidates: [string, string] = [
		join(here, "local-ui"),
		join(here, "..", "dist", "local-ui"),
	];
	return (
		candidates.find((path) => existsSync(join(path, "index.html"))) ??
		candidates[0]
	);
}

/** Static files are public; account data and bearer tokens remain in API calls. */
export function readLocalUiAsset(
	requestPath: string,
	directory: string,
): { body: Buffer; contentType: string } | undefined {
	const pathname = requestPath.split("?", 1)[0];
	if (
		!pathname ||
		(pathname !== "/" && !/^\/assets\/[A-Za-z0-9_./-]+$/.test(pathname))
	)
		return undefined;
	const segments = pathname.split("/");
	if (
		segments.some(
			(segment) =>
				segment === "." || segment === ".." || segment.startsWith("."),
		)
	)
		return undefined;
	const filename = pathname === "/" ? "index.html" : pathname.slice(1);
	const contentType = types[extname(filename)];
	if (!contentType || (pathname !== "/" && extname(filename) === ".html"))
		return undefined;
	try {
		const root = realpathSync(directory);
		const path = realpathSync(join(root, filename));
		const subpath = relative(root, path);
		if (
			isAbsolute(subpath) ||
			subpath === ".." ||
			subpath.startsWith(`..${sep}`) ||
			!statSync(path).isFile()
		)
			return undefined;
		return { body: readFileSync(path), contentType };
	} catch {
		return undefined;
	}
}
