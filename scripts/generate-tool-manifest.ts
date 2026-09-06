#!/usr/bin/env bun
/**
 * Records the tools the MCP server actually registers.
 *
 * Counting registration call sites in source over-counts, because some
 * registrations are conditional on wallet mode and never run. This boots the
 * real server and asks it, exactly as a client would, so the published figure
 * is the one users get.
 *
 * Run with `bun run tools:manifest`. `lib/tool-manifest.test.ts` fails if the
 * committed manifest no longer matches the server.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface ToolManifest {
	/** Every tool name a default client sees, sorted. */
	tools: string[];
}

export const MANIFEST_PATH = join(process.cwd(), "lib", "tool-manifest.json");

export async function readToolsFromServer(): Promise<string[]> {
	const transport = new StdioClientTransport({
		command: "bun",
		args: ["run", "index.ts", "--stdio"],
		env: {
			...process.env,
			TRANSPORT: "stdio",
			// No broadcasting and no keys: the default surface a new user gets.
			DISABLE_BROADCASTING: "true",
		},
		stderr: "pipe",
	});

	const client = new Client(
		{ name: "tool-manifest", version: "1.0.0" },
		{ capabilities: {} },
	);

	try {
		await client.connect(transport);
		const { tools } = await client.listTools();
		return tools.map((tool) => tool.name).sort();
	} finally {
		await client.close().catch(() => {});
	}
}

if (import.meta.main) {
	const tools = await readToolsFromServer();
	if (tools.length === 0) {
		console.error("Refusing to write an empty manifest.");
		process.exit(1);
	}
	const manifest: ToolManifest = { tools };
	writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, "\t")}\n`);
	console.log(`Wrote ${tools.length} tools to ${MANIFEST_PATH}`);
}
