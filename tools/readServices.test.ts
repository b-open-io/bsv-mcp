import { expect, test } from "bun:test";
import { OneSatServices } from "@1sat/client";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import {
	backendUrl,
	explorerFetch,
	explorerUrl,
	onesatUrl,
} from "../utils/backends";
import { registerExploreTool } from "./bsv/explore";
import { registerStatusTool } from "./bsv/status";
import { registerGetInscriptionTool } from "./ordinals/getInscription";
import { registerMarketListingsTool } from "./ordinals/marketListings";
import { registerMarketSalesTool } from "./ordinals/marketSales";
import { registerSearchInscriptionsTool } from "./ordinals/searchInscriptions";

// Exercise real MCP schemas and SDK routing against a compatible alternate backend.
test("walletless reads use the configured service, preserve pagination, and report failures", async () => {
	const requests: URL[] = [];
	const explorerKeys: (string | null)[] = [];
	const outpoint = `${"a".repeat(64)}.0`;
	const http = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch(request) {
			const url = new URL(request.url);
			requests.push(url);
			if (url.pathname.startsWith("/explorer/")) {
				explorerKeys.push(request.headers.get("X-API-Key"));
				expect(request.headers.has("X-Payment-Accept")).toBe(false);
			}
			if (url.pathname.endsWith("/capabilities"))
				return Response.json(["market", "txo", "ordfs"]);
			if (url.pathname.endsWith("/woc")) return new Response("BananaBlocks");
			if (url.pathname.endsWith("/hex")) return new Response("01000000");
			if (url.searchParams.get("q") === "offline")
				return Response.json(
					{ message: "Market unavailable" },
					{ status: 503 },
				);
			if (url.pathname.includes("/metadata/"))
				return Response.json({ outpoint });
			return Response.json([
				{ outpoint, score: 123.5, data: { ordlock: { price: 1000 } } },
			]);
		},
	});
	const previous = {
		ONESAT_API_URL: process.env.ONESAT_API_URL,
		WOC_API_URL: process.env.WOC_API_URL,
		EXPLORER_API_URL: process.env.EXPLORER_API_URL,
		EXPLORER_API_KEY: process.env.EXPLORER_API_KEY,
	};
	process.env.EXPLORER_API_KEY = "synthetic-explorer-key";
	process.env.ONESAT_API_URL = `${http.url}proxy/`;
	process.env.WOC_API_URL = `${http.url}legacy`;
	process.env.EXPLORER_API_URL = `${http.url}explorer`;
	const server = new McpServer({ name: "read-test", version: "1" });
	const client = new Client({ name: "test", version: "1" });
	const services = new OneSatServices("main", onesatUrl());
	registerMarketListingsTool(server, services);
	registerMarketSalesTool(server, services);
	registerSearchInscriptionsTool(server, services);
	registerGetInscriptionTool(server, services);
	registerStatusTool(server, { services });
	registerExploreTool(server);
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	try {
		await server.connect(serverTransport);
		await client.connect(clientTransport);
		expect(explorerUrl("main")).toBe(`${http.url}explorer/main`);
		delete process.env.EXPLORER_API_URL;
		expect(explorerUrl("test")).toBe(`${http.url}legacy/test`);
		delete process.env.WOC_API_URL;
		expect(explorerUrl("main")).toBe(
			"https://bananablocks.com/api/v1/bsv/main",
		);
		expect(explorerUrl("test")).toBe(
			"https://api.whatsonchain.com/v1/bsv/test",
		);
		process.env.EXPLORER_API_URL = `${http.url}explorer`;
		expect(onesatUrl()).toBe(`${http.url}proxy`);
		const listing = await client.callTool({
			name: "ordinals_marketListings",
			arguments: { limit: 1, from: 10, q: "cat" },
		});
		expect((listing.structuredContent as { nextFrom: number }).nextFrom).toBe(
			123.5,
		);
		expect(requests.at(-1)?.pathname).toBe("/proxy/1sat/market/listings");
		expect(requests.at(-1)?.searchParams.get("status")).toBe("active");
		expect(requests.at(-1)?.searchParams.get("from")).toBe("10");
		await client.callTool({ name: "ordinals_marketSales", arguments: {} });
		expect(requests.at(-1)?.searchParams.get("status")).toBe("sale");
		await client.callTool({
			name: "ordinals_searchInscriptions",
			arguments: { key: "own:address", limit: 1 },
		});
		expect(requests.at(-1)?.pathname).toBe("/proxy/1sat/txo/search");
		expect(requests.at(-1)?.searchParams.get("key")).toBe("own:address");
		expect(requests.at(-1)?.searchParams.get("unspent")).toBe("true");
		await client.callTool({
			name: "ordinals_getInscription",
			arguments: { outpoint: outpoint.replace(".", "_") },
		});
		expect(requests.at(-1)?.pathname).toBe(
			`/proxy/1sat/ordfs/metadata/${outpoint}`,
		);
		const status = await client.callTool({ name: "bsv_status", arguments: {} });
		expect((status.structuredContent as { service: unknown }).service).toEqual({
			status: "reachable",
			capabilities: ["market", "txo", "ordfs"],
		});
		const count = requests.length;
		await client.callTool({
			name: "bsv_status",
			arguments: { checkServices: false },
		});
		expect(requests.length).toBe(count);
		const failure = await client.callTool({
			name: "ordinals_marketListings",
			arguments: { q: "offline" },
		});
		expect(failure.isError).toBe(true);
		expect(JSON.stringify(failure.content)).toContain("Market unavailable");
		const invalid = await client.callTool({
			name: "ordinals_marketListings",
			arguments: { limit: 101 },
		});
		expect(invalid.isError).toBe(true);
		const health = await client.callTool({
			name: "bsv_explore",
			arguments: { endpoint: "health" },
		});
		expect(health.isError).not.toBe(true);
		expect(requests.at(-1)?.pathname).toMatch(/^\/explorer\/(main|test)\/woc$/);
		expect(JSON.stringify(health.content)).toContain("BananaBlocks");
		const raw = await client.callTool({
			name: "bsv_explore",
			arguments: { endpoint: "tx_raw", txHash: "a".repeat(64) },
		});
		expect(raw.isError).not.toBe(true);
		expect(JSON.stringify(raw.content)).toContain("01000000");
		expect(explorerKeys).toEqual([
			"synthetic-explorer-key",
			"synthetic-explorer-key",
		]);
		expect(() => explorerFetch("https://other.example/secret")).toThrow(
			"outside",
		);
		process.env.ONESAT_API_URL = "https://user:secret@example.com";
		expect(() => backendUrl("ONESAT_API_URL", "https://example.com")).toThrow(
			"without credentials",
		);
	} finally {
		await client.close();
		await server.close();
		http.stop(true);
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
});
