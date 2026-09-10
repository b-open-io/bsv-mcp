import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderDocsMarkdown } from "../lib/docs";

describe("Grok plugin packaging", () => {
	test("bundled MCP server uses the plugin root and does not load dotenv", () => {
		const mcp = JSON.parse(readFileSync(".mcp.json", "utf8")) as {
			mcpServers: {
				"bsv-mcp": { command: string; args: string[] };
			};
		};
		expect(mcp.mcpServers["bsv-mcp"].command).toBe("bun");
		expect(mcp.mcpServers["bsv-mcp"].args).toEqual([
			"--no-env-file",
			`\${CLAUDE_PLUGIN_ROOT}/dist/index.js`,
			"--stdio",
		]);
	});

	test("opening this repo in Grok launches the local bundled server", () => {
		const toml = readFileSync(".grok/config.toml", "utf8");
		expect(toml).toContain("[mcp_servers.bsv-mcp]");
		expect(toml).toContain('command = "bun"');
		expect(toml).toContain("--no-env-file");
		expect(toml).toContain("dist/index.js");
		expect(toml).toContain("--stdio");
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
