import { describe, expect, test } from "bun:test";
import { approximateTotal, countTools, getToolCounts } from "./tool-count";

describe("getToolCounts", () => {
	const counts = getToolCounts();

	test("finds registrations in every shipped category", () => {
		// Guards the registration regex: if the MCP registration API changes and
		// this scan stops matching, the landing page would quietly claim zero
		// tools rather than failing here.
		for (const dir of ["wallet", "bsv", "ordinals", "bap", "bsocial", "mnee"]) {
			expect(counts.byDirectory[dir]).toBeGreaterThan(0);
		}
	});

	test("totals only the categories enabled by default", () => {
		const summed = Object.entries(counts.byDirectory)
			.filter(([dir]) => dir !== "a2b")
			.reduce((total, [, count]) => total + count, 0);

		expect(counts.total).toBe(summed);
		expect(counts.total).toBeGreaterThan(50);
	});

	test("ignores test files", () => {
		// tools/bap has three sources but only one registers tools per file;
		// its *.test.ts neighbours must not inflate the count.
		expect(counts.byDirectory.bap).toBeLessThan(10);
	});
});

describe("countTools", () => {
	const counts = getToolCounts();

	test("sums the requested directories", () => {
		expect(countTools(counts, ["mnee", "utils"])).toBe(
			(counts.byDirectory.mnee ?? 0) + (counts.byDirectory.utils ?? 0),
		);
	});

	test("ignores unknown directories", () => {
		expect(countTools(counts, ["does-not-exist"])).toBe(0);
	});
});

describe("approximateTotal", () => {
	test("floors to the nearest bucket", () => {
		expect(approximateTotal(91)).toBe("90+");
		expect(approximateTotal(90)).toBe("90+");
		expect(approximateTotal(99)).toBe("90+");
	});

	test("returns null below one bucket", () => {
		expect(approximateTotal(0)).toBeNull();
		expect(approximateTotal(9)).toBeNull();
	});
});
