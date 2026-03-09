import { resolve } from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
	root: resolve(__dirname, "src/views"),
	plugins: [viteSingleFile()],
	build: {
		rollupOptions: {
			input: resolve(__dirname, "src/views/app.html"),
		},
		outDir: resolve(__dirname, "dist"),
		emptyOutDir: false,
	},
});
