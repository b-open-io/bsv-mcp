#!/usr/bin/env bun
// Install the stdout guard before loading dependencies with startup logging.
import "./utils/stdioGuard";

const runtime = await import("./server");
export const createConfiguredServer = runtime.createConfiguredServer;

if (import.meta.main) {
	try {
		await runtime.main();
	} catch (error) {
		console.error(
			error instanceof Error ? error.message : "Server initialization failed",
		);
		process.exitCode = 1;
	}
}
