import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderDocsMarkdown } from "../lib/docs";

describe("Grok plugin packaging", () => {
	test("plugin MCP runs the published npm package", () => {
		const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
			version: string;
		};
		const mcp = JSON.parse(readFileSync(".mcp.json", "utf8")) as {
			mcpServers: {
				"bsv-mcp": { command: string; args: string[] };
			};
		};
		expect(mcp.mcpServers["bsv-mcp"].command).toBe("npx");
		expect(mcp.mcpServers["bsv-mcp"].args).toEqual([
			"-y",
			`bsv-mcp@${pkg.version}`,
			"--stdio",
		]);
	});

	test("opening this repo in Grok runs source", () => {
		const toml = readFileSync(".grok/config.toml", "utf8");
		expect(toml).toContain("[mcp_servers.bsv-mcp]");
		expect(toml).toContain('command = "bun"');
		expect(toml).toContain("--no-env-file");
		expect(toml).toContain("index.ts");
		expect(toml).toContain("--stdio");
		expect(toml).not.toContain("dist/index.js");
		expect(toml).not.toMatch(/\$\{CLAUDE_PLUGIN_ROOT\}/);
	});

	test("plugin skill describes local stdio rather than hosted Sigma MCP", () => {
		const skill = readFileSync("skills/bsv-mcp/SKILL.md", "utf8");
		expect(skill).toContain("local stdio");
		expect(skill).not.toContain("hosted BSV MCP");
		expect(skill).not.toContain("authorize Sigma Identity");
	});

	test("docs quickstart includes the Grok plugin command", () => {
		expect(renderDocsMarkdown()).toContain(
			"grok plugin install b-open-io/bsv-mcp --trust",
		);
	});
});
