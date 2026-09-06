import { describe, expect, test } from "bun:test";
import {
	MEDIA_HTML,
	MEDIA_MARKDOWN,
	OFFERED_MEDIA,
	parseAccept,
	selectMediaType,
	VARY_HEADER,
} from "./content-negotiation";

const offered = OFFERED_MEDIA;

describe("parseAccept", () => {
	test("defaults q to 1 and lowercases ranges", () => {
		expect(parseAccept("TEXT/Markdown")).toEqual([
			{ type: "text", subtype: "markdown", q: 1 },
		]);
	});

	test("reads q parameters", () => {
		expect(parseAccept("text/html;q=0.8, text/markdown;q=0.9")).toEqual([
			{ type: "text", subtype: "html", q: 0.8 },
			{ type: "text", subtype: "markdown", q: 0.9 },
		]);
	});

	test("clamps out-of-range and ignores unparseable q", () => {
		expect(parseAccept("text/html;q=5")[0]?.q).toBe(1);
		expect(parseAccept("text/html;q=-1")[0]?.q).toBe(0);
		expect(parseAccept("text/html;q=abc")[0]?.q).toBe(1);
	});

	test("ignores malformed ranges", () => {
		expect(parseAccept("text, , text/html")).toEqual([
			{ type: "text", subtype: "html", q: 1 },
		]);
	});
});

describe("selectMediaType", () => {
	test("serves markdown when explicitly requested", () => {
		expect(selectMediaType("text/markdown", offered)).toBe(MEDIA_MARKDOWN);
	});

	test("honors q-values over header order", () => {
		expect(
			selectMediaType("text/html;q=0.8, text/markdown;q=0.9", offered),
		).toBe(MEDIA_MARKDOWN);
		expect(
			selectMediaType("text/markdown;q=0.4, text/html;q=0.9", offered),
		).toBe(MEDIA_HTML);
	});

	test("keeps HTML for a normal browser request", () => {
		const browser =
			"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
		expect(selectMediaType(browser, offered)).toBe(MEDIA_HTML);
	});

	test("falls back to server preference for wildcards and missing headers", () => {
		expect(selectMediaType("*/*", offered)).toBe(MEDIA_HTML);
		expect(selectMediaType("text/*", offered)).toBe(MEDIA_HTML);
		expect(selectMediaType(null, offered)).toBe(MEDIA_HTML);
		expect(selectMediaType("", offered)).toBe(MEDIA_HTML);
	});

	test("treats q=0 as unacceptable", () => {
		expect(selectMediaType("text/html;q=0, text/markdown", offered)).toBe(
			MEDIA_MARKDOWN,
		);
		expect(selectMediaType("*/*;q=0", offered)).toBeNull();
	});

	test("returns null when nothing offered is acceptable", () => {
		expect(selectMediaType("application/pdf", offered)).toBeNull();
		expect(selectMediaType("application/json", offered)).toBeNull();
	});

	test("prefers a specific range over a wildcard", () => {
		// The wildcard scores higher, but the exact match is more specific.
		expect(selectMediaType("text/markdown;q=0.5, */*;q=0.5", offered)).toBe(
			MEDIA_HTML,
		);
		expect(selectMediaType("text/markdown, */*;q=0.1", offered)).toBe(
			MEDIA_MARKDOWN,
		);
	});
});

describe("VARY_HEADER", () => {
	test("lists Accept so CDNs cannot cross-serve variants", () => {
		expect(VARY_HEADER).toContain("Accept");
		expect(VARY_HEADER).toContain("Accept-Encoding");
	});

	test("preserves the Next router variants", () => {
		for (const value of [
			"RSC",
			"Next-Router-State-Tree",
			"Next-Router-Prefetch",
			"Next-Router-Segment-Prefetch",
		]) {
			expect(VARY_HEADER).toContain(value);
		}
	});
});
