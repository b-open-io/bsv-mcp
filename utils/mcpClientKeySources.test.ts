import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrivateKey } from "@bsv/sdk";
import {
	eraseMcpClientEnvValue,
	inspectMcpClientKeySources,
	readMcpClientEnvValue,
} from "./mcpClientKeySources";
import { inspectMigration } from "./vaultMigration";

const homes: string[] = [];
afterEach(() => {
	for (const home of homes.splice(0))
		rmSync(home, { recursive: true, force: true });
});

function home(): string {
	const dir = mkdtempSync(join(tmpdir(), "bsv-mcp-client-keys-"));
	homes.push(dir);
	return dir;
}

test("detects a Cursor MCP payment WIF without returning the secret", () => {
	const root = home();
	const wif = PrivateKey.fromRandom().toWif();
	mkdirSync(join(root, ".cursor"), { recursive: true });
	writeFileSync(
		join(root, ".cursor", "mcp.json"),
		JSON.stringify({
			mcpServers: {
				"Bitcoin SV": {
					command: "bunx",
					args: ["bsv-mcp@latest"],
					env: { PRIVATE_KEY_WIF: wif },
				},
			},
		}),
	);
	const sources = inspectMcpClientKeySources(root);
	expect(sources).toHaveLength(1);
	expect(sources[0]).toMatchObject({
		location: "mcp-client",
		client: "cursor",
		serverName: "Bitcoin SV",
		envVar: "PRIVATE_KEY_WIF",
		plaintextKeys: true,
	});
	expect(JSON.stringify(sources)).not.toContain(wif);
	expect(
		readMcpClientEnvValue({
			configPath: join(root, ".cursor", "mcp.json"),
			serverName: "Bitcoin SV",
			envVar: "PRIVATE_KEY_WIF",
		}),
	).toBe(wif);
});

test("inventory lists Cursor MCP keys as importable sources", () => {
	const root = home();
	const wif = PrivateKey.fromRandom().toWif();
	mkdirSync(join(root, ".cursor"), { recursive: true });
	writeFileSync(
		join(root, ".cursor", "mcp.json"),
		JSON.stringify({
			mcpServers: {
				"Bitcoin SV": {
					command: "npx",
					env: { PRIVATE_KEY_WIF: wif },
				},
			},
		}),
	);
	const inventory = inspectMigration({ home: root, env: {} });
	expect(inventory.migrationRequired).toBe(true);
	expect(
		inventory.sources.some(
			(source) =>
				source.location === "mcp-client" && source.serverName === "Bitcoin SV",
		),
	).toBe(true);
	expect(JSON.stringify(inventory)).not.toContain(wif);
});

test("ignores empty or missing MCP env keys", () => {
	const root = home();
	mkdirSync(join(root, ".cursor"), { recursive: true });
	writeFileSync(
		join(root, ".cursor", "mcp.json"),
		JSON.stringify({
			mcpServers: {
				"bsv-mcp": { command: "npx", env: { PRIVATE_KEY_WIF: "" } },
			},
		}),
	);
	expect(inspectMcpClientKeySources(root)).toEqual([]);
});

test("erases an imported Cursor WIF without returning it", async () => {
	const root = home();
	const wif = PrivateKey.fromRandom().toWif();
	const configPath = join(root, ".cursor", "mcp.json");
	mkdirSync(join(root, ".cursor"), { recursive: true });
	writeFileSync(
		configPath,
		JSON.stringify({
			mcpServers: {
				"Bitcoin SV": {
					command: "npx",
					env: { PRIVATE_KEY_WIF: wif, ONESAT_API_URL: "https://api.1sat.app" },
				},
			},
		}),
	);
	expect(
		eraseMcpClientEnvValue({
			configPath,
			serverName: "Bitcoin SV",
			envVar: "PRIVATE_KEY_WIF",
		}),
	).toBe(true);
	const saved = JSON.parse(await Bun.file(configPath).text()) as {
		mcpServers: { "Bitcoin SV": { env?: Record<string, string> } };
	};
	expect(saved.mcpServers["Bitcoin SV"].env?.PRIVATE_KEY_WIF).toBeUndefined();
	expect(saved.mcpServers["Bitcoin SV"].env?.ONESAT_API_URL).toBe(
		"https://api.1sat.app",
	);
	expect(JSON.stringify(saved)).not.toContain(wif);
});
