import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * The React local application has two delivery targets. The loopback setup
 * server uses the normal asset build so its CSP can keep scripts and styles
 * external. MCP resource hosts receive a single-file copy because a ui://
 * document cannot resolve a relative /assets URL in every host.
 */
export default defineConfig(({ mode }) => {
	const mcpResource = mode === "mcp";
	return {
		root: resolve(__dirname, "src/views"),
		plugins: mcpResource
			? [viteSingleFile()]
			: [
					{
						name: "copy-local-ui-index",
						closeBundle() {
							copyFileSync(
								resolve(__dirname, "dist/local-ui/app.html"),
								resolve(__dirname, "dist/local-ui/index.html"),
							);
						},
					},
				],
		esbuild: {
			jsx: "automatic",
			jsxImportSource: "react",
		},
		build: {
			rollupOptions: {
				input: mcpResource
					? resolve(__dirname, "src/views/app.html")
					: { index: resolve(__dirname, "src/views/app.html") },
			},
			outDir: mcpResource
				? resolve(__dirname, "dist")
				: resolve(__dirname, "dist/local-ui"),
			// The local target owns its directory; the MCP target shares dist
			// with the server bundle and must preserve those siblings.
			emptyOutDir: !mcpResource,
		},
	};
});
