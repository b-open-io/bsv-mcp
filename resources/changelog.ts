import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Try multiple strategies to find the CHANGELOG.md file
 * Returns the content of the file or throws an error if not found
 */
function findAndReadChangelog(): string {
	// Log which paths we're trying
	console.log("Attempting to locate CHANGELOG.md...");
	
	// Strategy 1: Try to resolve from the current module's directory
	try {
		// Convert the URL of the current ESM module to a path
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		
		// Look for CHANGELOG.md in the project root (2 levels up from resources dir)
		const changelogPath = join(__dirname, "..", "..", "CHANGELOG.md");
		console.log(`Checking path: ${changelogPath}`);
		
		if (existsSync(changelogPath)) {
			console.log(`Found CHANGELOG.md at: ${changelogPath}`);
			return readFileSync(changelogPath, "utf-8");
		}
	} catch (error) {
		console.error("Error checking module path:", error);
	}
	
	// Strategy 2: Try to resolve from the current working directory
	try {
		const changelogPath = join(process.cwd(), "CHANGELOG.md");
		console.log(`Checking path: ${changelogPath}`);
		
		if (existsSync(changelogPath)) {
			console.log(`Found CHANGELOG.md at: ${changelogPath}`);
			return readFileSync(changelogPath, "utf-8");
		}
	} catch (error) {
		console.error("Error checking current working directory:", error);
	}
	
	// Strategy 3: Try to load from node_modules if running from installed package
	try {
		const changelogPath = join(process.cwd(), "node_modules", "bsv-mcp", "CHANGELOG.md");
		console.log(`Checking path: ${changelogPath}`);
		
		if (existsSync(changelogPath)) {
			console.log(`Found CHANGELOG.md at: ${changelogPath}`);
			return readFileSync(changelogPath, "utf-8");
		}
	} catch (error) {
		console.error("Error checking node_modules path:", error);
	}

	// List all files in current directory to help with debugging
	try {
		const fs = require("node:fs");
		console.log("Files in current directory:", fs.readdirSync(process.cwd()));
	} catch (error) {
		console.error("Error listing directory contents:", error);
	}

	// If we get here, we couldn't find the file
	throw new Error("Could not locate CHANGELOG.md in any of the expected locations");
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
			try {
				const changelogContent = findAndReadChangelog();
				return {
					contents: [
						{
							uri: uri.href,
							text: changelogContent,
						},
					],
				};
			} catch (error) {
				console.error("Failed to read CHANGELOG.md:", error);
				return {
					contents: [
						{
							uri: uri.href,
							text: "# BSV MCP Server Changelog\n\nError: Could not load changelog content.\nPlease check the server logs for more details.",
						},
					],
				};
			}
		}
	);
}
