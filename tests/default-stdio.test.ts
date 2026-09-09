import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import {
	type BuiltMcpExecutable,
	buildMcpExecutable,
} from "./helpers/mcp-wallet-modes";

let executable: BuiltMcpExecutable;
const home = mkdtempSync("/tmp/bsv-default-stdio-");
const env: NodeJS.ProcessEnv = {
	PATH: process.env.PATH,
	HOME: home,
	NODE_ENV: "test",
	DISABLE_WALLET_TOOLS: "true",
	DISABLE_BROADCASTING: "true",
	DISABLE_BAP_TOOLS: "true",
	DISABLE_BSOCIAL_TOOLS: "true",
	DISABLE_MNEE_TOOLS: "true",
};
beforeAll(() => {
	executable = buildMcpExecutable();
});
afterAll(() => {
	executable?.cleanup();
	rmSync(home, { recursive: true, force: true });
});

for (const modern of [false, true]) {
	test(`bare built executable serves ${modern ? "modern" : "legacy"} MCP with clean stdout`, async () => {
		const child = spawn(process.execPath, [executable.path], {
			cwd: home,
			env,
			stdio: ["pipe", "pipe", "pipe"],
		});
		let buffer = "";
		let stderr = "";
		const malformed: string[] = [];
		const pending = new Map<number, (value: Record<string, unknown>) => void>();
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.stdout.on("data", (chunk) => {
			buffer += chunk.toString();
			let lineEnd = buffer.indexOf("\n");
			while (lineEnd >= 0) {
				const line = buffer.slice(0, lineEnd);
				buffer = buffer.slice(lineEnd + 1);
				try {
					const value = JSON.parse(line);
					if (value.jsonrpc !== "2.0") malformed.push(line);
					pending.get(value.id)?.(value);
					pending.delete(value.id);
				} catch {
					malformed.push(line);
				}
				lineEnd = buffer.indexOf("\n");
			}
		});
		let nextID = 0;
		const meta = modern
			? {
					_meta: {
						"io.modelcontextprotocol/protocolVersion": "2026-07-28",
						"io.modelcontextprotocol/clientInfo": {
							name: "default-stdio",
							version: "1",
						},
						"io.modelcontextprotocol/clientCapabilities": {},
					},
				}
			: {};
		const request = (method: string, params: Record<string, unknown> = {}) =>
			new Promise<Record<string, unknown>>((resolve, reject) => {
				const id = ++nextID;
				const timer = setTimeout(
					() => reject(new Error(`No ${method} reply: ${stderr}`)),
					10_000,
				);
				pending.set(id, (value) => {
					clearTimeout(timer);
					resolve(value);
				});
				child.stdin.write(
					`${JSON.stringify({ jsonrpc: "2.0", id, method, params: { ...params, ...meta } })}\n`,
				);
			});
		try {
			const initial = await request(
				modern ? "server/discover" : "initialize",
				modern
					? {}
					: {
							protocolVersion: "2025-11-25",
							capabilities: {},
							clientInfo: { name: "default-stdio", version: "1" },
						},
			);
			expect(initial.error).toBeUndefined();
			if (!modern)
				child.stdin.write(
					`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
				);
			const listed = await request("tools/list");
			expect(JSON.stringify(listed)).toContain("bsv_dashboard");
			const converted = await request("tools/call", {
				name: "utils_convertData",
				arguments: { data: "hello", from: "utf8", to: "hex" },
			});
			expect(JSON.stringify(converted)).toContain("68656c6c6f");
			expect(malformed).toEqual([]);
			expect(stderr).toContain("running on stdio");
		} finally {
			child.kill();
		}
	}, 25_000);
}

test("invalid transport fails before external wallet initialization", () => {
	const result = spawnSync(process.execPath, [executable.path], {
		cwd: home,
		env: {
			...env,
			TRANSPORT: "invalid",
			BRC100_WALLET_URL: "http://127.0.0.1:1",
		},
		encoding: "utf8",
		timeout: 10_000,
	});
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("TRANSPORT must be stdio or http");
	expect(result.stderr).not.toContain("fetch failed");
});
