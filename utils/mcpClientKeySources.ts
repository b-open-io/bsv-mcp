import { randomBytes } from "node:crypto";
import {
	closeSync,
	constants,
	fstatSync,
	lstatSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { accountNameSchema } from "./accounts";

export const MCP_CLIENT_ENV_VARS = [
	"PRIVATE_KEY_WIF",
	"IDENTITY_KEY_WIF",
] as const;

export type McpClientEnvVar = (typeof MCP_CLIENT_ENV_VARS)[number];

export interface McpClientKeySource {
	account: string;
	location: "mcp-client";
	client: string;
	serverName: string;
	configPath: string;
	envVar: McpClientEnvVar;
	encryptedBackup: false;
	plaintextKeys: true;
	walletDatabases: [];
}

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readJsonFile(path: string): Json | undefined {
	if (!isAbsolute(path)) return undefined;
	let fd: number;
	try {
		fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		return undefined;
	}
	try {
		const stat = fstatSync(fd);
		if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return undefined;
		const parsed: unknown = JSON.parse(readFileSync(fd, "utf8"));
		return isJson(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	} finally {
		closeSync(fd);
	}
}

function slugAccount(client: string, server: string, envVar: string): string {
	const role = envVar === "IDENTITY_KEY_WIF" ? "identity" : "payment";
	const raw = `${client}-${server}-${role}`
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);
	return accountNameSchema.safeParse(raw).success
		? raw
		: `${client}-${role}`.slice(0, 64);
}

function serversFromConfig(config: Json): Array<[string, Json]> {
	const out: Array<[string, Json]> = [];
	const root = config.mcpServers;
	if (isJson(root)) {
		for (const [name, value] of Object.entries(root)) {
			if (isJson(value)) out.push([name, value]);
		}
	}
	const projects = config.projects;
	if (isJson(projects)) {
		for (const project of Object.values(projects)) {
			if (!isJson(project) || !isJson(project.mcpServers)) continue;
			for (const [name, value] of Object.entries(project.mcpServers)) {
				if (isJson(value)) out.push([name, value]);
			}
		}
	}
	return out;
}

function envString(server: Json, name: McpClientEnvVar): string | undefined {
	if (!isJson(server.env)) return undefined;
	const value = server.env[name];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function candidateFiles(home: string): Array<{ client: string; path: string }> {
	return [
		{ client: "cursor", path: join(home, ".cursor", "mcp.json") },
		{
			client: "claude-desktop",
			path: join(
				home,
				"Library",
				"Application Support",
				"Claude",
				"claude_desktop_config.json",
			),
		},
		{
			client: "claude-desktop",
			path: join(home, ".config", "Claude", "claude_desktop_config.json"),
		},
		{
			client: "claude-desktop",
			path: join(
				home,
				"AppData",
				"Roaming",
				"Claude",
				"claude_desktop_config.json",
			),
		},
		{ client: "claude-code", path: join(home, ".claude.json") },
	];
}

/**
 * Detect MCP client configs that still hold WIF env vars. Returns public
 * descriptors only — never the key material. Import re-reads the file.
 */
export function inspectMcpClientKeySources(
	home = homedir(),
): McpClientKeySource[] {
	if (!isAbsolute(home)) return [];
	const found: McpClientKeySource[] = [];
	const used = new Set<string>();
	for (const { client, path } of candidateFiles(home)) {
		const config = readJsonFile(path);
		if (!config) continue;
		for (const [serverName, server] of serversFromConfig(config)) {
			if (!envString(server, "PRIVATE_KEY_WIF")) continue;
			let account = slugAccount(client, serverName, "PRIVATE_KEY_WIF");
			let n = 2;
			while (used.has(account)) {
				account = `${slugAccount(client, serverName, "PRIVATE_KEY_WIF").slice(0, 62)}${n}`;
				n += 1;
			}
			used.add(account);
			found.push({
				account,
				location: "mcp-client",
				client,
				serverName,
				configPath: path,
				envVar: "PRIVATE_KEY_WIF",
				encryptedBackup: false,
				plaintextKeys: true,
				walletDatabases: [],
			});
		}
	}
	return found;
}

/** Re-read a previously detected client source. Returns undefined if gone. */
export function readMcpClientEnvValue(
	source: Pick<McpClientKeySource, "configPath" | "serverName" | "envVar">,
): string | undefined {
	const config = readJsonFile(source.configPath);
	if (!config) return undefined;
	for (const [name, server] of serversFromConfig(config)) {
		if (name !== source.serverName) continue;
		return envString(server, source.envVar);
	}
	return undefined;
}

function serverObjects(config: Json, serverName: string): Json[] {
	const out: Json[] = [];
	if (isJson(config.mcpServers) && isJson(config.mcpServers[serverName]))
		out.push(config.mcpServers[serverName]);
	if (isJson(config.projects)) {
		for (const project of Object.values(config.projects)) {
			if (
				isJson(project) &&
				isJson(project.mcpServers) &&
				isJson(project.mcpServers[serverName])
			)
				out.push(project.mcpServers[serverName]);
		}
	}
	return out;
}

function writeJsonFile(path: string, value: Json): void {
	const stat = lstatSync(path);
	if (stat.isSymbolicLink() || !stat.isFile())
		throw new Error("MCP client config must be a regular file.");
	const tmp = `${path}.${randomBytes(8).toString("hex")}.tmp`;
	try {
		writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, {
			mode: 0o600,
			flag: "wx",
		});
		renameSync(tmp, path);
	} catch (error) {
		try {
			rmSync(tmp, { force: true });
		} catch {
			// Best-effort cleanup of the staging file.
		}
		throw error;
	}
}

/**
 * Remove a previously imported WIF env var from an MCP client config.
 * Never logs or returns the secret. Best-effort overwrite of the JSON file.
 */
export function eraseMcpClientEnvValue(
	source: Pick<McpClientKeySource, "configPath" | "serverName" | "envVar">,
): boolean {
	const config = readJsonFile(source.configPath);
	if (!config) return false;
	let changed = false;
	for (const server of serverObjects(config, source.serverName)) {
		if (!isJson(server.env)) continue;
		if (!(source.envVar in server.env)) continue;
		delete server.env[source.envVar];
		if (Object.keys(server.env).length === 0) delete server.env;
		changed = true;
	}
	if (!changed) return false;
	writeJsonFile(source.configPath, config);
	return true;
}
