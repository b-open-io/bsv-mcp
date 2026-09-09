import { describe, expect, test } from "bun:test";
import { readToolsFromServer } from "../scripts/generate-tool-manifest";
import { toolCategories } from "./site-content";
import {
	allToolNames,
	approximateTotal,
	countTools,
	getToolCounts,
	toolsInCategory,
} from "./tool-count";
import manifest from "./tool-manifest.json";

describe("tool manifest", () => {
	test(
		"matches the tools the server actually registers",
		async () => {
			// The published count must be what a client sees. If this fails, run
			// `bun run tools:manifest` and commit the result.
			const live = await readToolsFromServer();
			expect(live.length).toBeGreaterThan(0);
			expect(manifest.tools).toEqual(live);
		},
		{ timeout: 120_000 },
	);

	test("names are unique and prefixed", () => {
		expect(new Set(allToolNames).size).toBe(allToolNames.length);
		for (const name of allToolNames) expect(name).toContain("_");
	});
});

describe("categories", () => {
	const counts = getToolCounts();

	test("partition every tool exactly once", () => {
		// A new tool prefix must be categorised deliberately rather than
		// silently vanishing from the totals shown on the site.
		const seen = new Map<string, string[]>();
		for (const category of toolCategories) {
			for (const name of toolsInCategory(category)) {
				seen.set(name, [...(seen.get(name) ?? []), category.key]);
			}
		}

		const uncategorised = allToolNames.filter((name) => !seen.has(name));
		expect(uncategorised).toEqual([]);

		const duplicated = [...seen.entries()].filter(
			([, keys]) => keys.length > 1,
		);
		expect(duplicated).toEqual([]);
	});

	test("category counts sum to the total", () => {
		const sum = toolCategories.reduce(
			(total, category) => total + countTools(counts, category.key),
			0,
		);
		expect(sum).toBe(counts.total);
	});

	test("every category has at least one tool", () => {
		for (const category of toolCategories) {
			expect(countTools(counts, category.key)).toBeGreaterThan(0);
		}
	});

	test("unknown categories count zero", () => {
		expect(countTools(counts, "nope")).toBe(0);
	});
});

describe("approximateTotal", () => {
	test("floors to the nearest bucket", () => {
		expect(approximateTotal(80)).toBe("80+");
		expect(approximateTotal(89)).toBe("80+");
		expect(approximateTotal(91)).toBe("90+");
	});

	test("returns null below one bucket", () => {
		expect(approximateTotal(0)).toBeNull();
		expect(approximateTotal(9)).toBeNull();
	});

	test("never overstates the real total", () => {
		const { total } = getToolCounts();
		const shown = approximateTotal(total);
		expect(shown).not.toBeNull();
		expect(Number.parseInt(shown as string, 10)).toBeLessThanOrEqual(total);
	});
});
