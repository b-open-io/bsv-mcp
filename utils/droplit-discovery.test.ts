import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { AuthFetch } from "@bsv/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDroplitDiscoveryTool } from "../tools/wallet/droplitDiscovery";
import { discoverDroplitSponsors, readDroplitSponsorConfig } from "./droplit";

const api = "https://api.example.test/prefix";
const body = {
	sponsors: [
		{ name: "Example", slug: "example", approval_required: true as const },
	],
	next_cursor: null,
};
afterEach(() => mock.restore());

test("discovery is unsigned, strips unexpected private fields, and encodes pagination", async () => {
	const signed = spyOn(AuthFetch.prototype, "fetch").mockImplementation(() => {
		throw new Error("must not authenticate");
	});
	const fetch = spyOn(globalThis, "fetch").mockResolvedValue(
		Response.json({
			...body,
			owner_key: "private",
			sponsors: [{ ...body.sponsors[0], owner_key: "private" }],
		}),
	);
	expect(readDroplitSponsorConfig({ DROPLIT_API_URL: api })).toBeUndefined();
	expect(
		await discoverDroplitSponsors(api, { limit: 2, after: "a&injected=true" }),
	).toEqual(body);
	const [url, options] = fetch.mock.calls[0];
	expect(String(url)).toBe(`${api}/sponsors?limit=2&after=a%26injected%3Dtrue`);
	expect(options).toMatchObject({
		method: "GET",
		redirect: "error",
		credentials: "omit",
	});
	expect(options?.headers).toBeUndefined();
	expect(signed).not.toHaveBeenCalled();
});

test("invalid URL and limits fail before fetch; HTTP and invalid bodies are redacted", async () => {
	const fetch = spyOn(globalThis, "fetch");
	for (const invalid of [
		"http://evil.test",
		"https://user:password@api.test",
		"https://api.test?x=1",
	]) {
		await expect(discoverDroplitSponsors(invalid)).rejects.toThrow();
	}
	for (const limit of [0, 51, 1.5])
		await expect(discoverDroplitSponsors(api, { limit })).rejects.toThrow();
	expect(fetch).not.toHaveBeenCalled();
	fetch.mockResolvedValueOnce(new Response("secret", { status: 402 }));
	await expect(discoverDroplitSponsors(api)).rejects.toMatchObject({
		code: "request_failed",
		status: 402,
	});
	fetch.mockResolvedValueOnce(
		Response.json({
			...body,
			sponsors: [{ ...body.sponsors[0], approval_required: false }],
		}),
	);
	await expect(discoverDroplitSponsors(api)).rejects.toMatchObject({
		code: "invalid_response",
	});
	fetch.mockRejectedValueOnce(new Error("credential leak"));
	await expect(discoverDroplitSponsors(api)).rejects.toThrow(
		"Could not read public sponsors. Check the configured API origin.",
	);
});

test("MCP discovery requires no wallet or selected sponsor and preserves empty catalog", async () => {
	const fetch = spyOn(globalThis, "fetch").mockResolvedValue(
		Response.json({ sponsors: [], next_cursor: null }),
	);
	const server = new McpServer({ name: "discovery", version: "1" });
	registerDroplitDiscoveryTool(server, api);
	const client = new Client({ name: "buyer", version: "1" });
	const [a, b] = InMemoryTransport.createLinkedPair();
	await server.connect(a);
	await client.connect(b);
	try {
		const listed = await client.listTools();
		expect(
			listed.tools.find((t) => t.name === "droplit_discover")?.annotations
				?.readOnlyHint,
		).toBe(true);
		const result = await client.callTool({
			name: "droplit_discover",
			arguments: {},
		});
		expect(result.structuredContent).toEqual({
			sponsors: [],
			next_cursor: null,
		});
		expect(String(fetch.mock.calls[0][0])).toBe(`${api}/sponsors?limit=20`);
		const invalid = await client.callTool({
			name: "droplit_discover",
			arguments: { limit: 51 },
		});
		expect(invalid.isError).toBe(true);
		expect(fetch).toHaveBeenCalledTimes(1);
	} finally {
		await client.close();
		await server.close();
	}
});
