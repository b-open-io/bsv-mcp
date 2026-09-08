import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcessByStdio, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable } from "node:stream";

const LEGACY_PROTOCOL_VERSION = "2025-11-25";
const MODERN_PROTOCOL_VERSION = "2026-07-28";
const repoRoot = join(import.meta.dir, "..");
const serverEntry = join(repoRoot, "index.ts");

const modernEnvelope = {
	"io.modelcontextprotocol/protocolVersion": MODERN_PROTOCOL_VERSION,
	"io.modelcontextprotocol/clientInfo": {
		name: "bsv-mcp-http-regression",
		version: "1.0.0",
	},
	"io.modelcontextprotocol/clientCapabilities": {},
};

type JsonRpcResponse = {
	jsonrpc: "2.0";
	id: number | string | null;
	result?: Record<string, unknown>;
	error?: Record<string, unknown>;
};

type ChildResult = {
	code: number | null;
	signal: NodeJS.Signals | null;
};

function delay(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new Error(`Timed out waiting for ${label}`)),
			ms,
		);
	});
	return Promise.race([promise, timeout]).finally(() => {
		if (timer !== undefined) clearTimeout(timer);
	});
}

async function unusedLoopbackPort() {
	const probe = createServer();
	await new Promise<void>((resolve, reject) => {
		probe.once("error", reject);
		probe.listen(0, "127.0.0.1", () => resolve());
	});
	const address = probe.address();
	if (address === null || typeof address === "string") {
		probe.close();
		throw new Error("The operating system did not provide an ephemeral port");
	}
	const port = address.port;
	await new Promise<void>((resolve, reject) => {
		probe.close((error) => (error ? reject(error) : resolve()));
	});
	return port;
}

function cleanEnvironment(
	home: string,
	tempCwd: string,
	port: number,
): NodeJS.ProcessEnv {
	return {
		NODE_ENV: "test",
		PATH: process.env.PATH ?? "/usr/bin:/bin",
		HOME: home,
		TMPDIR: tempCwd,
		TRANSPORT: "http",
		PORT: String(port),
		// The integration server must pass this through to Bun.serve({ hostname })
		// so this subprocess is reachable only on the loopback interface.
		HOST: "127.0.0.1",
		DISABLE_WALLET_TOOLS: "true",
		ENABLE_OAUTH: "false",
		DISABLE_BROADCASTING: "true",
		BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0",
	};
}

async function responseJson(response: Response): Promise<JsonRpcResponse> {
	const body = await response.text();
	const dataLine = body
		.split(/\r?\n/)
		.find((line) => line.startsWith("data: "));
	const json = dataLine === undefined ? body : dataLine.slice("data: ".length);
	return JSON.parse(json) as JsonRpcResponse;
}

function headerTokens(response: Response, name: string) {
	return (response.headers.get(name) ?? "")
		.split(",")
		.map((token) => token.trim().toLowerCase())
		.filter(Boolean);
}

function toolNames(result: JsonRpcResponse) {
	const tools = result.result?.tools;
	expect(Array.isArray(tools), "tools/list result did not contain tools").toBe(
		true,
	);
	return (tools as Array<{ name: string }>).map((tool) => tool.name);
}

class HttpServerProcess {
	readonly child: ChildProcessByStdio<null, Readable, Readable>;
	readonly origin: string;
	readonly closed: Promise<ChildResult>;
	private stderr = "";

	constructor(
		readonly home: string,
		readonly tempCwd: string,
		readonly port: number,
	) {
		this.origin = `http://127.0.0.1:${port}`;
		this.child = spawn(process.execPath, ["--no-env-file", serverEntry], {
			cwd: tempCwd,
			env: cleanEnvironment(home, tempCwd, port),
			stdio: ["ignore", "pipe", "pipe"],
		});

		this.closed = new Promise((resolve) => {
			this.child.once("close", (code, signal) => resolve({ code, signal }));
		});
		this.child.stderr.setEncoding("utf8");
		this.child.stderr.on("data", (chunk: string) => {
			this.stderr += chunk;
		});
	}

	async waitUntilReady() {
		const deadline = Date.now() + 15_000;
		let lastError: unknown;
		while (Date.now() < deadline) {
			if (this.child.exitCode !== null) {
				throw new Error(this.exitDescription());
			}

			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 500);
			try {
				// Any response from an unrelated path proves Bun.serve is listening;
				// it avoids creating an MCP session during readiness polling.
				const response = await fetch(`${this.origin}/__mcp_http_ready__`, {
					signal: controller.signal,
				});
				await response.arrayBuffer();
				return;
			} catch (error) {
				lastError = error;
			} finally {
				clearTimeout(timer);
			}
			await delay(50);
		}
		throw new Error(
			`Timed out waiting for HTTP server: ${String(lastError)}\n${this.stderr}`,
		);
	}

	exitDescription() {
		return `HTTP server exited before listening (code=${this.child.exitCode}, signal=${this.child.signalCode})\n${this.stderr}`;
	}

	async stop() {
		if (this.child.exitCode === null) {
			this.child.kill("SIGTERM");
		}
		try {
			await withTimeout(this.closed, 1_000, "HTTP server shutdown");
		} catch {
			// ChildProcess.killed means a signal was sent, not that the process
			// exited. Escalate after the grace period so a stuck Bun listener
			// cannot survive the test process.
			if (this.child.exitCode === null) {
				this.child.kill("SIGKILL");
			}
			await withTimeout(
				this.closed,
				2_000,
				"HTTP server forced shutdown",
			).catch(() => {});
		}
	}
}

describe("self-hosted Bun Streamable HTTP transport", () => {
	let tempRoot: string;
	let home: string;
	let tempCwd: string;
	let server: HttpServerProcess;

	beforeAll(async () => {
		tempRoot = mkdtempSync(join(tmpdir(), "bsv-mcp-http-"));
		home = join(tempRoot, "home");
		tempCwd = join(tempRoot, "cwd");
		mkdirSync(home);
		mkdirSync(tempCwd);

		const port = await unusedLoopbackPort();
		server = new HttpServerProcess(home, tempCwd, port);
		await server.waitUntilReady();
	});

	afterAll(async () => {
		if (server !== undefined) await server.stop();
		if (tempRoot !== undefined)
			rmSync(tempRoot, { recursive: true, force: true });
	});

	test("serves modern tools/list with the mandatory negotiation headers", async () => {
		const response = await fetch(`${server.origin}/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				"Mcp-Protocol-Version": MODERN_PROTOCOL_VERSION,
				"Mcp-Method": "tools/list",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/list",
				params: { _meta: modernEnvelope },
			}),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("access-control-allow-origin")).toBe("*");
		expect(headerTokens(response, "access-control-allow-methods")).toContain(
			"post",
		);
		expect(headerTokens(response, "access-control-allow-headers")).toEqual(
			expect.arrayContaining([
				"content-type",
				"mcp-protocol-version",
				"mcp-method",
			]),
		);
		const message = await responseJson(response);
		expect(message.id).toBe(1);
		expect(message.error).toBeUndefined();
		expect(toolNames(message)).toContain("bsv_dashboard");
	});

	test("keeps legacy initialize and its sessionful tools/list exchange working", async () => {
		const initialize = await fetch(`${server.origin}/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 2,
				method: "initialize",
				params: {
					protocolVersion: LEGACY_PROTOCOL_VERSION,
					capabilities: {},
					clientInfo: {
						name: "bsv-mcp-http-regression",
						version: "1.0.0",
					},
				},
			}),
		});
		const sessionId = initialize.headers.get("mcp-session-id");
		expect(initialize.status).toBe(200);
		expect(sessionId).toBeTruthy();
		const initialized = await responseJson(initialize);
		expect(initialized.id).toBe(2);
		expect(initialized.error).toBeUndefined();
		expect(initialized.result?.protocolVersion).toBe(LEGACY_PROTOCOL_VERSION);

		try {
			const notification = await fetch(`${server.origin}/mcp`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
					"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
					"Mcp-Session-Id": sessionId as string,
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					method: "notifications/initialized",
				}),
			});
			expect(notification.status).toBe(202);
			await notification.arrayBuffer();

			const list = await fetch(`${server.origin}/mcp`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
					"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
					"Mcp-Session-Id": sessionId as string,
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 3,
					method: "tools/list",
					params: {},
				}),
			});
			expect(list.status).toBe(200);
			const listed = await responseJson(list);
			expect(listed.id).toBe(3);
			expect(listed.error).toBeUndefined();
			expect(toolNames(listed)).toContain("bsv_dashboard");
		} finally {
			const closed = await fetch(`${server.origin}/mcp`, {
				method: "DELETE",
				headers: {
					Accept: "application/json, text/event-stream",
					"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
					"Mcp-Session-Id": sessionId as string,
				},
			});
			await closed.arrayBuffer();
		}
	});

	test("answers CORS preflight and rejects unsupported HTTP methods", async () => {
		const preflight = await fetch(`${server.origin}/mcp`, {
			method: "OPTIONS",
			headers: {
				Origin: "https://example.test",
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers":
					"content-type,mcp-protocol-version,mcp-method",
			},
		});
		expect(preflight.status).toBe(204);
		expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
		expect(headerTokens(preflight, "access-control-allow-methods")).toEqual(
			expect.arrayContaining(["post", "options"]),
		);
		expect(headerTokens(preflight, "access-control-allow-headers")).toEqual(
			expect.arrayContaining([
				"content-type",
				"mcp-protocol-version",
				"mcp-method",
			]),
		);
		await preflight.arrayBuffer();

		for (const method of ["PUT", "PATCH"]) {
			const response = await fetch(`${server.origin}/mcp`, {
				method,
				headers: { Accept: "application/json, text/event-stream" },
			});
			expect(response.status, `${method} should be rejected`).toBe(405);
			expect(response.headers.get("allow")).toContain("POST");
			expect(response.headers.get("access-control-allow-origin")).toBe("*");
			await response.arrayBuffer();
		}
	});
});
