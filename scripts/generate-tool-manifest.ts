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
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createConfiguredServer } from "../index";
import type { ToolsConfig } from "../tools";
import type { ToolCatalogProfile } from "../tools/compactCatalog";
import { Wallet } from "../tools/wallet/wallet";
import {
	type CatalogMode,
	catalogFixture,
	catalogModes,
} from "./tool-catalog-fixtures";

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
	const toolsConfig: ToolsConfig = {
		wallet,
		disableBroadcasting: true,
		enableAccountTools: true,
		...normalized.toolsConfig,
		...(normalized.profile ? { toolCatalog: normalized.profile } : {}),
	};
	const server = createConfiguredServer({
		toolsConfig,
		wallet: toolsConfig.wallet,
		ctx: toolsConfig.ctx,
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

export type CatalogDefinition = ToolCapture["tools"][number];
export interface GeneratedTool {
	name: string;
	variants: {
		definition: CatalogDefinition;
		modes: string[];
		profile: "full" | "compact";
	}[];
}

/** Each capture gets a clean process: host wallet configuration cannot affect docs. */
export function captureCatalogFixture(
	mode: CatalogMode,
	profile: "full" | "compact",
): CatalogDefinition[] {
	const result = spawnSync(
		process.execPath,
		["--no-env-file", import.meta.filename, "--capture", mode, profile],
		{
			cwd: process.cwd(),
			encoding: "utf8",
			maxBuffer: 8 * 1024 * 1024,
			env: {
				PATH: process.env.PATH,
				NODE_ENV: "test",
				TRANSPORT: "stdio",
				DISABLE_BROADCASTING: "false",
			},
		},
	);
	if (
		mode === "no-roles" &&
		result.status !== 0 &&
		result.stderr.includes("No wallet key roles are assigned")
	)
		return [];
	if (result.status !== 0)
		throw new Error(
			`Catalog capture ${mode}/${profile} failed: ${result.stderr}`,
		);
	return JSON.parse(result.stdout);
}

export function generateCatalog() {
	const entries = new Map<string, GeneratedTool>();
	for (const mode of catalogModes) {
		for (const profile of ["full", "compact"] as const) {
			for (const definition of captureCatalogFixture(mode.id, profile)) {
				const entry = entries.get(definition.name) ?? {
					name: definition.name,
					variants: [],
				};
				const serialized = JSON.stringify(definition);
				const variant = entry.variants.find(
					(v) =>
						v.profile === profile &&
						JSON.stringify(v.definition) === serialized,
				);
				if (variant) variant.modes.push(mode.id);
				else entry.variants.push({ definition, modes: [mode.id], profile });
				entries.set(entry.name, entry);
			}
		}
	}
	return {
		modes: catalogModes,
		tools: [...entries.values()].sort((a, b) => a.name.localeCompare(b.name)),
	};
}

if (import.meta.main) {
	if (process.argv[2] === "--capture") {
		const mode = process.argv[3] as CatalogMode;
		const profile = process.argv[4] as "full" | "compact";
		if (
			!catalogModes.some((m) => m.id === mode) ||
			!["full", "compact"].includes(profile)
		)
			throw new Error("Unknown catalog fixture");
		globalThis.fetch = Object.assign(
			() => {
				throw new Error("Catalog generation must not access the network");
			},
			{
				preconnect: () => {
					throw new Error("Catalog generation must not access the network");
				},
			},
		);
		const capture = await captureToolsFromServer({
			profile,
			toolsConfig: catalogFixture(mode),
		});
		if (!capture.deterministic) throw new Error("Nondeterministic tools/list");
		process.stdout.write(capture.serialized);
	} else {
		const tools = await readToolsFromServer();
		if (!tools.length) throw new Error("Refusing to write an empty manifest");
		writeFileSync(MANIFEST_PATH, `${JSON.stringify({ tools }, null, "\t")}\n`);
		const catalog = generateCatalog();
		writeFileSync(
			join(process.cwd(), "lib/tool-catalog.json"),
			`${JSON.stringify(catalog, null, "\t")}\n`,
		);
		console.error(
			`Wrote ${tools.length} baseline names and ${catalog.tools.length} catalog entries`,
		);
	}
}
