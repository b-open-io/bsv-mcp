import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Register the changelog resource with the MCP server
 * @param server The MCP server instance
 */
export function registerChangelogResource(server: McpServer): void {
  server.resource(
    "bsv-mcp-changelog",
    "https://github.com/b-open-io/bsv-mcp/blob/main/CHANGELOG.md",
    {
      title: "BSV MCP Server Changelog",
      description: "Version history and changelog for the BSV MCP server",
    },
    async (uri) => {
      try {
        // Read the CHANGELOG.md file from the project root
        const changelogPath = join(process.cwd(), "CHANGELOG.md");
        const changelogContent = readFileSync(changelogPath, "utf-8");
        
        return {
          contents: [
            {
              uri: uri.href,
              text: changelogContent,
            },
          ],
        };
      } catch (error) {
        console.error("Error reading CHANGELOG.md:", error);
        return {
          contents: [
            {
              uri: uri.href,
              text: "# BSV MCP Server Changelog\n\nError: Could not load changelog content.",
            },
          ],
        };
      }
    }
  );
} 