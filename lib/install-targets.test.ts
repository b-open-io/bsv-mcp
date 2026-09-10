import { describe, expect, test } from "bun:test";
import { renderHomeMarkdown } from "./markdown";
import { installTargets } from "./site-content";

describe("installTargets", () => {
	test("keys and labels are unique", () => {
		const keys = installTargets.map((t) => t.key);
		const labels = installTargets.map((t) => t.label);
		expect(new Set(keys).size).toBe(keys.length);
		expect(new Set(labels).size).toBe(labels.length);
	});

	test("every target carries instructions and an official docs link", () => {
		for (const target of installTargets) {
			const hasInstructions = Boolean(target.command || target.config);
			expect(hasInstructions).toBe(true);
			expect(target.docsUrl.startsWith("https://")).toBe(true);
		}
	});

	test("a config always says where it belongs", () => {
		for (const target of installTargets) {
			if (target.config) expect(target.configPath).toBeTruthy();
		}
	});

	test("TOML clients get TOML and JSON clients get JSON", () => {
		for (const target of installTargets) {
			if (!target.config || !target.configPath) continue;
			if (target.configPath.endsWith(".toml")) {
				expect(target.config).toContain("[mcp_servers.");
				expect(target.config.trimStart().startsWith("{")).toBe(false);
			}
			if (target.configPath.endsWith(".json")) {
				expect(() => JSON.parse(target.config as string)).not.toThrow();
			}
		}
	});

	test("omits clients without verified MCP support", () => {
		// pi has no MCP support by design, so it must not appear with invented
		// configuration. See lib/site-content.ts for the rationale.
		const keys = installTargets.map((t) => t.key);
		expect(keys).not.toContain("pi");
	});

	test("every documented client reaches the markdown docs", () => {
		const doc = renderHomeMarkdown();
		for (const target of installTargets) {
			expect(doc).toContain(`### ${target.label}`);
			expect(doc).toContain(target.docsUrl);
		}
	});

	test("Grok plugin install includes --trust so MCP servers start", () => {
		const grok = installTargets.find((target) => target.key === "grok");
		expect(grok?.command).toBe("grok plugin install b-open-io/bsv-mcp --trust");
		expect(grok?.altCommands?.[0]?.command).toContain("grok mcp add bsv-mcp");
		expect(grok?.note).toContain("--trust");
		expect(grok?.note).toContain("Bun");
	});
});
