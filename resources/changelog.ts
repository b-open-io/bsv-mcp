import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const CHANGELOG_URL =
	"https://raw.githubusercontent.com/b-open-io/bsv-mcp/master/CHANGELOG.md";

/**
 * Fetches the changelog from GitHub
 * @returns Promise that resolves to the changelog content
 */
async function fetchChangelog(): Promise<string> {
	try {
		const response = await fetch(CHANGELOG_URL);

		if (!response.ok) {
			throw new Error(
				`Failed to fetch changelog: ${response.status} ${response.statusText}`,
			);
		}

		return await response.text();
	} catch (error) {
		console.error("Error fetching changelog:", error);
		return "# BSV MCP Server Changelog\n\nError: Could not load changelog content.\nPlease check the server logs for more details.";
	}
}

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
			const changelogContent = await fetchChangelog();
			return {
				contents: [
					{
						uri: uri.href,
						text: changelogContent,
					},
				],
			};
		},
	);
}
