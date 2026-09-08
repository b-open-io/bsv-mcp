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
import type { ToolsConfig } from "../tools";
import type { ToolCatalogProfile } from "../tools/compactCatalog";
import { Wallet } from "../tools/wallet/wallet";

export interface ToolManifest {
	/** Every tool name a default client sees, sorted. */
	tools: string[];
}

export const MANIFEST_PATH = join(process.cwd(), "lib", "tool-manifest.json");

export type ToolCaptureOptions = {
	profile?: ToolCatalogProfile;
	toolsConfig?: ToolsConfig;
};

export type ToolCapture = {
	tools: Awaited<ReturnType<Client["listTools"]>>["tools"];
	serialized: string;
	bytes: number;
	secondSerialized: string;
	deterministic: boolean;
};

function normalizeCaptureOptions(
	options: ToolCaptureOptions | ToolCatalogProfile = {},
): ToolCaptureOptions {
	return typeof options === "string" ? { profile: options } : options;
}

/**
 * Boot the real server and capture complete tool definitions from tools/list.
 * The profile is a server-side option; no request data participates in
 * registration. The second listTools call makes determinism measurable for
 * byte-size comparisons.
 */
export async function captureToolsFromServer(
	options: ToolCaptureOptions | ToolCatalogProfile = {},
): Promise<ToolCapture> {
	const normalized = normalizeCaptureOptions(options);
	// Register with a synthetic, never-funded wallet. No key files, storage or startup network calls.
	const wallet = Object.create(Wallet.prototype) as Wallet;
	const server = createConfiguredServer({
		toolsConfig: {
			wallet,
			disableBroadcasting: true,
			enableAccountTools: true,
			...normalized.toolsConfig,
			...(normalized.profile ? { toolCatalog: normalized.profile } : {}),
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
		const secondTools = (await client.listTools()).tools;
		const serialized = JSON.stringify(tools);
		const secondSerialized = JSON.stringify(secondTools);
		return {
			tools,
			serialized,
			bytes: Buffer.byteLength(serialized, "utf8"),
			secondSerialized,
			deterministic: serialized === secondSerialized,
		};
	} finally {
		await client.close();
		await server.close();
	}
}

export async function listToolsFromServer(
	options: ToolCaptureOptions | ToolCatalogProfile = {},
) {
	return (await captureToolsFromServer(options)).tools;
}

export async function readToolsFromServer(
	options: ToolCaptureOptions | ToolCatalogProfile = {},
): Promise<string[]> {
	return (await listToolsFromServer(options)).map((tool) => tool.name).sort();
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
