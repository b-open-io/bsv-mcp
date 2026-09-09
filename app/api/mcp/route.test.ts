import { describe, expect, spyOn, test } from "bun:test";
import { PrivateKey } from "@bsv/sdk";

if (process.env.BSV_HOSTED_ROUTE_TEST_CHILD !== "1") {
	test("hosted route isolation", async () => {
		const child = Bun.spawn([process.execPath, "test", import.meta.path], {
			env: { ...process.env, BSV_HOSTED_ROUTE_TEST_CHILD: "1" },
			stdout: "pipe",
			stderr: "pipe",
		});
		const [out, err, code] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		expect(code, out + err).toBe(0);
	}, 30000);
} else {
	// Sentinel key-like values prove the hosted route fails closed: it must never
	// parse them, and its tool surface must stay read-only regardless.
	process.env.PRIVATE_KEY_WIF = "sentinel-payment-wif-value";
	process.env.IDENTITY_KEY_WIF = "sentinel-identity-wif-value";
	process.env.DISABLE_BROADCASTING = "false";

	const fromWifSpy = spyOn(PrivateKey, "fromWif");

	process.env.ENABLE_OAUTH = "false";
	process.env.MCP_LEGACY_COMPATIBILITY = "false";
	const modernPrimaryRoute = await import("./route.ts" + "?modern-primary");
	delete process.env.MCP_LEGACY_COMPATIBILITY;
	const openRoute = await import("./route.ts");
	delete process.env.ENABLE_OAUTH;
	const protectedRoute = await import("./route.ts" + "?auth-required");

	const LEGACY_HEADERS = { "Mcp-Protocol-Version": "2025-11-25" };
	const MODERN_HEADERS = {
		"Mcp-Protocol-Version": "2026-07-28",
		"Mcp-Method": "tools/list",
	};
	const modernEnvelope = {
		"io.modelcontextprotocol/protocolVersion": "2026-07-28",
		"io.modelcontextprotocol/clientInfo": { name: "route-test", version: "1" },
		"io.modelcontextprotocol/clientCapabilities": {},
	};

	function post(body: unknown, headers: Record<string, string> = {}) {
		return new Request("https://host/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				...headers,
			},
			body: JSON.stringify(body),
		});
	}

	async function rpcBody(response: Response) {
		const text = await response.text();
		if (text.startsWith("event:")) {
			return JSON.parse(text.split("data: ")[1]?.split("\n")[0] ?? "null");
		}
		return JSON.parse(text);
	}

	test("hosted modern primary rejects legacy requests", async () => {
		const request = {
			jsonrpc: "2.0",
			id: 77,
			method: "tools/list",
			params: {},
		};
		const rejected = await modernPrimaryRoute.POST(
			post(request, LEGACY_HEADERS),
		);
		expect((await rpcBody(rejected)).error?.code).toBe(-32022);
		const accepted = await modernPrimaryRoute.POST(
			post({ ...request, params: { _meta: modernEnvelope } }, MODERN_HEADERS),
		);
		expect((await rpcBody(accepted)).result?.tools).toBeDefined();
	});

	function expectCors(response: Response) {
		expect(response.headers.get("access-control-allow-origin")).toBe("*");
		const methods = response.headers.get("access-control-allow-methods") ?? "";
		for (const method of ["OPTIONS", "GET", "POST", "DELETE"]) {
			expect(methods).toContain(method);
		}
		const allowed = (
			response.headers.get("access-control-allow-headers") ?? ""
		).toLowerCase();
		for (const header of [
			"authorization",
			"content-type",
			"mcp-session-id",
			"last-event-id",
			"mcp-protocol-version",
			"mcp-method",
			"mcp-name",
		]) {
			expect(allowed).toContain(header);
		}
		expect(
			(
				response.headers.get("access-control-expose-headers") ?? ""
			).toLowerCase(),
		).toContain("mcp-session-id");
	}

	function toolNames(listData: {
		result?: { tools?: { name: string }[] };
	}): string[] {
		return (listData.result?.tools ?? []).map((tool) => tool.name);
	}

	const FORBIDDEN_PREFIXES = ["wallet_", "bap_", "mnee_", "x402_", "droplit_"];
	const FORBIDDEN_EXACT = [
		"wallet_list",
		"bsocial_publish",
		"utils_installAgentMaster",
	];

	describe("hosted MCP route CORS", () => {
		test("unauthenticated OPTIONS returns 204 with CORS headers", async () => {
			const response = await protectedRoute.OPTIONS();
			expect(response.status).toBe(204);
			expectCors(response);
		});

		test("protected unauthenticated POST/GET/DELETE deny with CORS headers", async () => {
			const denied = await protectedRoute.POST(post({}));
			expect(denied.status).toBe(401);
			expectCors(denied);

			const getDenied = await protectedRoute.GET(
				new Request("https://host/api/mcp", {
					headers: { Accept: "text/event-stream" },
				}),
			);
			expect(getDenied.status).toBe(401);
			expectCors(getDenied);

			const deleteDenied = await protectedRoute.DELETE(
				new Request("https://host/api/mcp", { method: "DELETE" }),
			);
			expect(deleteDenied.status).toBe(401);
			expectCors(deleteDenied);
		});
	});

	describe("hosted MCP route read-only surface", () => {
		test("modern tools/list exposes only reviewed public reads", async () => {
			const callsBefore = fromWifSpy.mock.calls.length;
			const response = await openRoute.POST(
				post(
					{
						jsonrpc: "2.0",
						id: 1,
						method: "tools/list",
						params: { _meta: modernEnvelope },
					},
					MODERN_HEADERS,
				),
			);
			expect(response.status).toBe(200);
			expectCors(response);
			const names = toolNames(await rpcBody(response));

			expect(names.length).toBeGreaterThan(0);
			for (const name of [
				"bsv_getPrice",
				"bsv_decodeTransaction",
				"bsv_explore",
				"bsv_status",
				"ordinals_getInscription",
				"ordinals_searchInscriptions",
				"ordinals_marketListings",
				"ordinals_marketSales",
				"ordinals_getTokenByIdOrTicker",
				"bsocial_read",
				"utils_convertData",
				"utils_find_skills",
			]) {
				expect(names).toContain(name);
			}
			for (const name of names) {
				expect(
					FORBIDDEN_PREFIXES.some((prefix) => name.startsWith(prefix)),
				).toBe(false);
				expect(FORBIDDEN_EXACT).not.toContain(name);
			}
			// Sentinel key material is never parsed during hosted initialization.
			expect(fromWifSpy.mock.calls.length).toBe(callsBefore);
		});

		test("modern tools/list matches and a local read executes", async () => {
			const response = await openRoute.POST(
				post(
					{
						jsonrpc: "2.0",
						id: 2,
						method: "tools/list",
						params: { _meta: modernEnvelope },
					},
					MODERN_HEADERS,
				),
			);
			expect(response.status).toBe(200);
			expectCors(response);
			const names = toolNames(await rpcBody(response));
			for (const name of names) {
				expect(
					FORBIDDEN_PREFIXES.some((prefix) => name.startsWith(prefix)),
				).toBe(false);
			}

			const call = await openRoute.POST(
				post(
					{
						jsonrpc: "2.0",
						id: 3,
						method: "tools/call",
						params: {
							name: "utils_convertData",
							arguments: { data: "hello", from: "utf8", to: "hex" },
							_meta: modernEnvelope,
						},
					},
					{
						"Mcp-Protocol-Version": "2026-07-28",
						"Mcp-Method": "tools/call",
						"Mcp-Name": "utils_convertData",
					},
				),
			);
			expect(call.status).toBe(200);
			expectCors(call);
			const callData = await rpcBody(call);
			expect(callData.error).toBeUndefined();
			expect(callData.result?.content?.[0]?.text).toBe("68656c6c6f");
		});

		test("a mutating-tool attempt fails without entering any callback", async () => {
			const callsBefore = fromWifSpy.mock.calls.length;
			const response = await openRoute.POST(
				post(
					{
						jsonrpc: "2.0",
						id: 4,
						method: "tools/call",
						params: {
							name: "wallet_sendBsv",
							arguments: { destination: "1ExampleDestination" },
							_meta: modernEnvelope,
						},
					},
					{
						...MODERN_HEADERS,
						"Mcp-Method": "tools/call",
						"Mcp-Name": "wallet_sendBsv",
					},
				),
			);
			expect(response.status).toBe(200);
			expectCors(response);
			const data = await rpcBody(response);
			expect(data.result?.content).toBeUndefined();
			expect(JSON.stringify(data.error ?? data)).toMatch(/unknown|not found/i);
			expect(fromWifSpy.mock.calls.length).toBe(callsBefore);
		});
	});
}
