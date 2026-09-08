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
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createConfiguredServer } from "../index";
import { Wallet } from "../tools/wallet/wallet";

export interface ToolManifest {
	/** Every tool name a default client sees, sorted. */
	tools: string[];
}

export const MANIFEST_PATH = join(process.cwd(), "lib", "tool-manifest.json");

export async function readToolsFromServer(): Promise<string[]> {
	// Register with a synthetic, never-funded wallet. No key files, storage or startup network calls.
	const wallet = Object.create(Wallet.prototype) as Wallet;
	const server = createConfiguredServer({
		toolsConfig: {
			wallet,
			disableBroadcasting: true,
			enableAccountTools: true,
		},
		wallet,
		loadPrompts: true,
		loadResources: true,
	});
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const client = new Client({ name: "tool-manifest", version: "1.0.0" });
	try {
		await server.connect(serverTransport);
		await client.connect(clientTransport);
		const { tools } = await client.listTools();
		return tools.map((tool) => tool.name).sort();
	} finally {
		await client.close();
		await server.close();
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
