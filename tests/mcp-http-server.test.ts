import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcessByStdio, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
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

// Exact CORS surface advertised by the live Bun.serve handler in server.ts:
// Access-Control-Allow-Methods, Access-Control-Allow-Headers and
// Access-Control-Expose-Headers. Compared case-insensitively through
// headerTokens, which lowercases every token.
const EXPECTED_ALLOW_METHODS = ["get", "post", "delete", "options"];
const EXPECTED_ALLOW_HEADERS = [
	"content-type",
	"authorization",
	"mcp-session-id",
	"last-event-id",
	"mcp-protocol-version",
	"mcp-method",
	"mcp-name",
];
const EXPECTED_EXPOSE_HEADERS = [
	"mcp-session-id",
	"mcp-protocol-version",
	"mcp-method",
	"mcp-name",
];

function expectCompleteCors(response: Response) {
	expect(response.headers.get("access-control-allow-origin")).toBe("*");
	const methods = headerTokens(response, "access-control-allow-methods");
	expect(methods).toEqual(expect.arrayContaining(EXPECTED_ALLOW_METHODS));
	expect(methods).toHaveLength(EXPECTED_ALLOW_METHODS.length);
	const allowed = headerTokens(response, "access-control-allow-headers");
	expect(allowed).toEqual(expect.arrayContaining(EXPECTED_ALLOW_HEADERS));
	expect(allowed).toHaveLength(EXPECTED_ALLOW_HEADERS.length);
	const exposed = headerTokens(response, "access-control-expose-headers");
	expect(exposed).toEqual(expect.arrayContaining(EXPECTED_EXPOSE_HEADERS));
	expect(exposed).toHaveLength(EXPECTED_EXPOSE_HEADERS.length);
}

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
		expectCompleteCors(response);
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
			expect(closed.status).toBe(200);
			expectCompleteCors(closed);
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
		expectCompleteCors(preflight);
		await preflight.arrayBuffer();

		for (const method of ["PUT", "PATCH"]) {
			const response = await fetch(`${server.origin}/mcp`, {
				method,
				headers: { Accept: "application/json, text/event-stream" },
			});
			expect(response.status, `${method} should be rejected`).toBe(405);
			expect(response.headers.get("allow")).toContain("GET");
			expect(response.headers.get("allow")).toContain("POST");
			expect(response.headers.get("allow")).toContain("DELETE");
			expectCompleteCors(response);
			await response.arrayBuffer();
		}
	});

	test("terminates a legacy session with DELETE and rejects session reuse", async () => {
		const initialize = await fetch(`${server.origin}/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 10,
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
		expect(initialized.id).toBe(10);
		expect(initialized.error).toBeUndefined();

		let deleted = false;
		const sessionHeaders = {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
			"Mcp-Session-Id": sessionId as string,
		};
		try {
			const closed = await fetch(`${server.origin}/mcp`, {
				method: "DELETE",
				headers: {
					Accept: "application/json, text/event-stream",
					"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
					"Mcp-Session-Id": sessionId as string,
				},
			});
			expect(closed.status).toBe(200);
			expectCompleteCors(closed);
			await closed.arrayBuffer();
			deleted = true;

			const reuse = await fetch(`${server.origin}/mcp`, {
				method: "POST",
				headers: sessionHeaders,
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 11,
					method: "tools/list",
					params: {},
				}),
			});
			expect(reuse.status).toBe(404);
			expect(reuse.headers.get("access-control-allow-origin")).toBe("*");
			expect(headerTokens(reuse, "access-control-expose-headers")).toEqual(
				expect.arrayContaining(EXPECTED_EXPOSE_HEADERS),
			);
			const reused = await responseJson(reuse);
			expect(reused.error?.code).toBe(-32001);
			expect(String(reused.error?.message)).toContain("Session not found");

			const deletedAgain = await fetch(`${server.origin}/mcp`, {
				method: "DELETE",
				headers: {
					Accept: "application/json, text/event-stream",
					"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
					"Mcp-Session-Id": sessionId as string,
				},
			});
			expect(deletedAgain.status).toBe(404);
			await deletedAgain.arrayBuffer();

			const unknown = await fetch(`${server.origin}/mcp`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
					"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
					"Mcp-Session-Id": randomUUID(),
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 12,
					method: "tools/list",
					params: {},
				}),
			});
			expect(unknown.status).toBe(404);
			const unknownBody = await responseJson(unknown);
			expect(unknownBody.error?.code).toBe(-32001);
			expect(String(unknownBody.error?.message)).toContain("Session not found");
		} finally {
			if (!deleted) {
				const cleanup = await fetch(`${server.origin}/mcp`, {
					method: "DELETE",
					headers: {
						Accept: "application/json, text/event-stream",
						"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
						"Mcp-Session-Id": sessionId as string,
					},
				}).catch(() => undefined);
				await cleanup?.arrayBuffer().catch(() => {});
			}
		}
	});

	test("rejects malformed modern protocol metadata on the live endpoint", async () => {
		const modernHeaders = {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			"Mcp-Protocol-Version": MODERN_PROTOCOL_VERSION,
			"Mcp-Method": "tools/list",
		};

		// Missing Mcp-Method header while the body names tools/list.
		const missingMethod = await fetch(`${server.origin}/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				"Mcp-Protocol-Version": MODERN_PROTOCOL_VERSION,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 21,
				method: "tools/list",
				params: { _meta: modernEnvelope },
			}),
		});
		expect(missingMethod.status).toBe(400);
		expectCompleteCors(missingMethod);
		const missingMethodBody = await responseJson(missingMethod);
		expect(missingMethodBody.id).toBe(21);
		expect(missingMethodBody.error?.code).toBe(-32020);
		expect(String(missingMethodBody.error?.message)).toContain("Mcp-Method");

		// Modern protocol-version header without the required per-request envelope.
		const withoutEnvelope = await fetch(`${server.origin}/mcp`, {
			method: "POST",
			headers: modernHeaders,
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 22,
				method: "tools/list",
				params: {},
			}),
		});
		expect(withoutEnvelope.status).toBe(400);
		expect(withoutEnvelope.headers.get("access-control-allow-origin")).toBe(
			"*",
		);
		const withoutEnvelopeBody = await responseJson(withoutEnvelope);
		expect(withoutEnvelopeBody.id).toBe(22);
		expect(withoutEnvelopeBody.error?.code).toBe(-32602);
		expect(String(withoutEnvelopeBody.error?.message)).toContain("envelope");

		// Malformed envelope: the protocol-version claim must be a string.
		const badEnvelope = await fetch(`${server.origin}/mcp`, {
			method: "POST",
			headers: modernHeaders,
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 23,
				method: "tools/list",
				params: {
					_meta: {
						"io.modelcontextprotocol/protocolVersion": 123,
					},
				},
			}),
		});
		expect(badEnvelope.status).toBe(400);
		expect(badEnvelope.headers.get("access-control-allow-origin")).toBe("*");
		const badEnvelopeBody = await responseJson(badEnvelope);
		expect(badEnvelopeBody.id).toBe(23);
		expect(badEnvelopeBody.error?.code).toBe(-32602);
		expect(String(badEnvelopeBody.error?.message)).toContain("envelope");

		// Wrong media type for a modern request.
		const wrongContentType = await fetch(`${server.origin}/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "text/plain",
				Accept: "application/json, text/event-stream",
				"Mcp-Protocol-Version": MODERN_PROTOCOL_VERSION,
				"Mcp-Method": "tools/list",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 24,
				method: "tools/list",
				params: { _meta: modernEnvelope },
			}),
		});
		expect(wrongContentType.status).toBe(415);
		expect(wrongContentType.headers.get("access-control-allow-origin")).toBe(
			"*",
		);
		const wrongContentTypeBody = await responseJson(wrongContentType);
		expect(wrongContentTypeBody.error?.code).toBe(-32000);
		expect(String(wrongContentTypeBody.error?.message)).toContain(
			"Unsupported Media Type",
		);

		// JSON-RPC batches may not contain modern requests.
		const batch = await fetch(`${server.origin}/mcp`, {
			method: "POST",
			headers: modernHeaders,
			body: JSON.stringify([
				{
					jsonrpc: "2.0",
					id: 25,
					method: "tools/list",
					params: { _meta: modernEnvelope },
				},
			]),
		});
		expect(batch.status).toBe(400);
		expect(batch.headers.get("access-control-allow-origin")).toBe("*");
		const batchBody = await responseJson(batch);
		expect(batchBody.error?.code).toBe(-32600);
		expect(String(batchBody.error?.message)).toContain("batch");

		// The legacy initialize handshake must not carry a modern header.
		const modernInitialize = await fetch(`${server.origin}/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				"Mcp-Protocol-Version": MODERN_PROTOCOL_VERSION,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 26,
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
		expect(modernInitialize.status).toBe(400);
		expect(modernInitialize.headers.get("access-control-allow-origin")).toBe(
			"*",
		);
		const modernInitializeBody = await responseJson(modernInitialize);
		expect(modernInitializeBody.id).toBe(26);
		expect(modernInitializeBody.error?.code).toBe(-32020);
		expect(String(modernInitializeBody.error?.message)).toContain("initialize");
	});
});
