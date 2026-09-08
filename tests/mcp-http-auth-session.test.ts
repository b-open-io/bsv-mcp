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

const LEGACY_PROTOCOL_VERSION = "2025-11-25";
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

describe("authenticated live session binding (synthetic local JWKS)", () => {
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

	async function initializeSession(token: string, id: number | string) {
		return await fetch(`${server.origin}/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
				...bearer(token),
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id,
				method: "initialize",
				params: {
					protocolVersion: LEGACY_PROTOCOL_VERSION,
					capabilities: {},
					clientInfo: {
						name: "bsv-mcp-auth-session-regression",
						version: "1.0.0",
					},
				},
			}),
		});
	}

	async function listTools(
		token: string,
		sessionId: string,
		id: number | string,
	) {
		return await fetch(`${server.origin}/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
				"Mcp-Session-Id": sessionId,
				...bearer(token),
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id,
				method: "tools/list",
				params: {},
			}),
		});
	}

	async function deleteSession(token: string, sessionId: string) {
		return await fetch(`${server.origin}/mcp`, {
			method: "DELETE",
			headers: {
				Accept: "application/json, text/event-stream",
				"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
				"Mcp-Session-Id": sessionId,
				...bearer(token),
			},
		});
	}

	async function closeSessionBestEffort(token: string, sessionId: string) {
		try {
			const response = await deleteSession(token, sessionId);
			await response.arrayBuffer().catch(() => {});
		} catch {
			// Best-effort cleanup only.
		}
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

	test("principal A can initialize and list; invalid token returns 401", async () => {
		const initialize = await initializeSession(tokenA, 101);
		const sessionId = initialize.headers.get("mcp-session-id");
		try {
			expect(initialize.status).toBe(200);
			expect(sessionId).toBeTruthy();
			const initialized = await responseJson(initialize);
			expect(initialized.id).toBe(101);
			expect(initialized.error).toBeUndefined();
			expect(initialized.result?.protocolVersion).toBe(LEGACY_PROTOCOL_VERSION);

			const listed = await listTools(tokenA, sessionId as string, 102);
			expect(listed.status).toBe(200);
			const listedBody = await responseJson(listed);
			expect(listedBody.id).toBe(102);
			expect(listedBody.error).toBeUndefined();
		} finally {
			await closeSessionBestEffort(tokenA, sessionId as string);
		}

		const invalid = await initializeSession("invalid.token.here", 103);
		expect(invalid.status).toBe(401);
		const invalidBody = (await invalid.json()) as Record<string, unknown>;
		expect(invalidBody.error).toBe("invalid_token");
		expect(invalid.headers.get("www-authenticate")).toContain("invalid_token");
		await invalid.arrayBuffer().catch(() => {});
	});

	test("principal B cannot use A's session but is independently valid", async () => {
		const initializeA = await initializeSession(tokenA, 201);
		const sessionA = initializeA.headers.get("mcp-session-id");
		expect(initializeA.status).toBe(200);
		expect(sessionA).toBeTruthy();
		const initializedA = await responseJson(initializeA);
		expect(initializedA.error).toBeUndefined();

		try {
			const listA = await listTools(tokenA, sessionA as string, 202);
			expect(listA.status).toBe(200);
			const listABody = await responseJson(listA);
			expect(listABody.error).toBeUndefined();

			// Establish that B's token is independently valid with its own session.
			const initializeB = await initializeSession(tokenB, 203);
			const sessionB = initializeB.headers.get("mcp-session-id");
			expect(initializeB.status).toBe(200);
			expect(sessionB).toBeTruthy();
			expect(sessionB).not.toBe(sessionA);
			const initializedB = await responseJson(initializeB);
			expect(initializedB.error).toBeUndefined();
			try {
				const listB = await listTools(tokenB, sessionB as string, 204);
				expect(listB.status).toBe(200);
				const listBBody = await responseJson(listB);
				expect(listBBody.error).toBeUndefined();
			} finally {
				await closeSessionBestEffort(tokenB, sessionB as string);
			}

			// B must not POST against A's session.
			const crossPost = await listTools(tokenB, sessionA as string, 205);
			expect(crossPost.status).toBe(403);
			const crossPostBody = await responseJson(crossPost);
			expect(crossPostBody.error?.code).toBe(-32003);
			expect(String(crossPostBody.error?.message)).toContain(
				"different principal",
			);

			// B must not GET A's session stream.
			const crossGet = await fetch(`${server.origin}/mcp`, {
				method: "GET",
				headers: {
					Accept: "application/json, text/event-stream",
					"Mcp-Protocol-Version": LEGACY_PROTOCOL_VERSION,
					"Mcp-Session-Id": sessionA as string,
					...bearer(tokenB),
				},
			});
			expect(crossGet.status).toBe(403);
			await crossGet.arrayBuffer();

			// B must not destroy A's session.
			const crossDelete = await deleteSession(tokenB, sessionA as string);
			expect(crossDelete.status).toBe(403);
			await crossDelete.arrayBuffer();

			// A still owns the session after B's failed attempts.
			const listAgain = await listTools(tokenA, sessionA as string, 206);
			expect(listAgain.status).toBe(200);
			const listAgainBody = await responseJson(listAgain);
			expect(listAgainBody.error).toBeUndefined();

			const deleted = await deleteSession(tokenA, sessionA as string);
			expect(deleted.status).toBe(200);
			await deleted.arrayBuffer();

			const reuse = await listTools(tokenA, sessionA as string, 207);
			expect(reuse.status).toBe(404);
			const reuseBody = await responseJson(reuse);
			expect(reuseBody.error?.code).toBe(-32001);
		} finally {
			await closeSessionBestEffort(tokenA, sessionA as string);
		}
	});
});
