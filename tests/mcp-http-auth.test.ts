import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcessByStdio, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";

const MODERN_PROTOCOL_VERSION = "2026-07-28";
const repoRoot = join(import.meta.dir, "..");
const serverEntry = join(repoRoot, "index.ts");

type JsonRpcResponse = {
	jsonrpc: "2.0";
	id: number | string | null;
	result?: Record<string, unknown>;
	error?: { code?: number; message?: string };
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
	const probe = createTcpServer();
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

function cleanAuthEnvironment(
	home: string,
	tempCwd: string,
	port: number,
	issuer: string,
	resourceUrl: string,
): NodeJS.ProcessEnv {
	return {
		NODE_ENV: "test",
		PATH: process.env.PATH ?? "/usr/bin:/bin",
		HOME: home,
		TMPDIR: tempCwd,
		TRANSPORT: "http",
		PORT: String(port),
		HOST: "127.0.0.1",
		DISABLE_WALLET_TOOLS: "true",
		DISABLE_BROADCASTING: "true",
		ENABLE_OAUTH: "true",
		OAUTH_ISSUER: issuer,
		RESOURCE_URL: resourceUrl,
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

class AuthHttpServerProcess {
	readonly child: ChildProcessByStdio<null, Readable, Readable>;
	readonly origin: string;
	readonly closed: Promise<ChildResult>;
	private stderr = "";

	constructor(
		readonly home: string,
		readonly tempCwd: string,
		readonly port: number,
		issuer: string,
		resourceUrl: string,
	) {
		this.origin = `http://127.0.0.1:${port}`;
		// --no-env-file suppresses dotenv loading so the spawned runtime only
		// sees the isolated environment constructed above.
		this.child = spawn(process.execPath, ["--no-env-file", serverEntry], {
			cwd: tempCwd,
			env: cleanAuthEnvironment(home, tempCwd, port, issuer, resourceUrl),
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

describe("authenticated modern HTTP requests (synthetic local JWKS)", () => {
	let tempRoot: string;
	let home: string;
	let tempCwd: string;
	let server: AuthHttpServerProcess;
	let jwksServer: Server | undefined;
	let issuer = "";
	let resourceUrl = "";
	let privateKey: CryptoKey;
	let kid = "";
	let tokenA = "";
	let tokenB = "";
	const subjectA = `session-a-${randomUUID()}`;
	const subjectB = `session-b-${randomUUID()}`;

	async function mintToken(sub: string) {
		return await new SignJWT({})
			.setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
			.setIssuer(issuer)
			.setAudience(resourceUrl)
			.setSubject(sub)
			.setIssuedAt()
			.setExpirationTime("1h")
			.sign(privateKey);
	}

	function bearer(token: string) {
		return { Authorization: `Bearer ${token}` };
	}

	async function listTools(token: string, id: number) {
		return fetch(`${server.origin}/mcp`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "Mcp-Protocol-Version": MODERN_PROTOCOL_VERSION, "Mcp-Method": "tools/list", ...bearer(token) },
			body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/list", params: { _meta: {
				"io.modelcontextprotocol/protocolVersion": MODERN_PROTOCOL_VERSION,
				"io.modelcontextprotocol/clientInfo": { name: "auth-test", version: "1" },
				"io.modelcontextprotocol/clientCapabilities": {},
			} } }),
		});
	}

	beforeAll(async () => {
		tempRoot = mkdtempSync(join(tmpdir(), "bsv-mcp-auth-session-"));
		home = join(tempRoot, "home");
		tempCwd = join(tempRoot, "cwd");
		mkdirSync(home);
		mkdirSync(tempCwd);

		// Ephemeral asymmetric key for the synthetic issuer. Never written.
		const keypair = await generateKeyPair("RS256");
		privateKey = keypair.privateKey;
		kid = randomUUID();
		const publicJwk: JWK = await exportJWK(keypair.publicKey);
		publicJwk.kid = kid;
		publicJwk.alg = "RS256";
		publicJwk.use = "sig";
		const jwksBody = JSON.stringify({ keys: [publicJwk] });

		// Synthetic local JWKS issuer on loopback only.
		const jwksPort = await unusedLoopbackPort();
		issuer = `http://127.0.0.1:${jwksPort}`;
		jwksServer = createHttpServer((req, res) => {
			const pathname = (req.url ?? "").split("?")[0];
			if (req.method === "GET" && pathname === "/.well-known/jwks.json") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(jwksBody);
				return;
			}
			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("Not Found");
		});
		await new Promise<void>((resolve, reject) => {
			jwksServer?.once("error", reject);
			jwksServer?.listen(jwksPort, "127.0.0.1", () => resolve());
		});

		const mcpPort = await unusedLoopbackPort();
		resourceUrl = `http://127.0.0.1:${mcpPort}`;
		server = new AuthHttpServerProcess(
			home,
			tempCwd,
			mcpPort,
			issuer,
			resourceUrl,
		);
		try {
			await server.waitUntilReady();
		} catch (error) {
			await server.stop();
			throw error;
		}

		// Real signed tokens validated through JWKS retrieval + signature
		// verification in the spawned server. No validation is mocked.
		tokenA = await mintToken(subjectA);
		tokenB = await mintToken(subjectB);
	});

	afterAll(async () => {
		if (server !== undefined) await server.stop();
		if (jwksServer !== undefined) {
			await new Promise<void>((resolve) => jwksServer?.close(() => resolve()));
			jwksServer = undefined;
		}
		if (tempRoot !== undefined) {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	test("verifies each user's JWT independently without transport sessions", async () => {
		for (const [index, token] of [tokenA, tokenB, await mintToken(subjectA)].entries()) {
			const response = await listTools(token, index);
			expect(response.status).toBe(200);
			expect(response.headers.get("mcp-session-id")).toBeNull();
			const body = await responseJson(response);
			expect(body.error).toBeUndefined();
			expect(body.result?.tools).toBeDefined();
		}
	});
	test("rejects invalid and missing credentials before MCP execution", async () => {
		for (const token of ["invalid.token.here", ""]) {
			const response = await listTools(token, 10);
			expect(response.status).toBe(401);
			expect(response.headers.get("www-authenticate")).toContain("invalid_token");
			expect((await response.json()).error).toBe("invalid_token");
		}
	});
});
