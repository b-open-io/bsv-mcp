import fs from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// TypeScript interfaces for BigBlocks registry
interface BigBlocksComponent {
	name: string;
	type: string;
	description: string;
	files?: string[];
	dependencies?: string[];
	registryDependencies?: string[];
}

interface BigBlocksRegistry {
	components: BigBlocksComponent[];
	version?: string;
}

interface OrganizedComponents {
	[category: string]: {
		[subcategory: string]: BigBlocksComponent[];
	};
}

// Load BigBlocks registry data
function loadBigBlocksRegistry(): BigBlocksRegistry | null {
	try {
		const registryPath = path.resolve(
			"node_modules/bigblocks/registry/registry.json",
		);
		const registryData = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
		return registryData as BigBlocksRegistry;
	} catch (error) {
		console.error("Failed to load BigBlocks registry:", error);
		return null;
	}
}

// Organize components by type for easier browsing
function organizeComponentsByType(
	registry: BigBlocksRegistry,
): OrganizedComponents {
	const organized: OrganizedComponents = {};

	if (!registry?.components) return organized;

	for (const component of registry.components) {
		const [category, subcategory] = component.type.split(":");

		if (!organized[category]) {
			organized[category] = {};
		}

		if (!organized[category][subcategory]) {
			organized[category][subcategory] = [];
		}

		organized[category][subcategory].push(component);
	}

	return organized;
}

const componentSearchSchema = z.object({
	category: z
		.string()
		.optional()
		.describe("Component category to search in (component, hook)"),
	type: z
		.string()
		.optional()
		.describe(
			"Component type to filter by (auth, social, wallet, market, profile, backup, ui, bap, provider, layout)",
		),
	component: z
		.string()
		.optional()
		.describe("Specific component name to get details for"),
	search: z
		.string()
		.optional()
		.describe("Search term to find components by name or description"),
	showAll: z.boolean().optional().describe("Show all available components"),
});

/**
 * Register the BigBlocks component discovery tool
 */
export function registerBigBlocksComponentTool(server: McpServer): void {
	server.tool(
		"bigblocks_components",
		"Discover and learn about BigBlocks React components from the official registry. BigBlocks provides 96+ production-ready components for Bitcoin applications.\n\n" +
			"Usage examples:\n" +
			'- List all components: {"showAll": true}\n' +
			'- Browse by category: {"category": "component"}\n' +
			'- Filter by type: {"type": "social"}\n' +
			'- Get component details: {"component": "auth-flow"}\n' +
			'- Search components: {"search": "authentication"}\n\n' +
			"Categories:\n" +
			"- component: React components (auth, social, wallet, market, profile, backup, ui, bap, provider, layout)\n" +
			"- hook: React hooks for various functionalities\n\n" +
			"Types:\n" +
			"- auth: Authentication and login components\n" +
			"- social: Social media and networking\n" +
			"- wallet: Bitcoin wallet operations\n" +
			"- market: NFT and token marketplace\n" +
			"- profile: User profile management\n" +
			"- backup: Key backup and recovery\n" +
			"- ui: General UI components\n" +
			"- bap: Bitcoin Application Protocol\n" +
			"- provider: Context providers\n" +
			"- layout: Layout components",
		{ args: componentSearchSchema },
		async ({ args }) => {
			try {
				const registry = loadBigBlocksRegistry();
				if (!registry) {
					return {
						content: [
							{
								type: "text",
								text: "Error: Could not load BigBlocks registry data",
							},
						],
						isError: true,
					};
				}

				const { category, type, component, search, showAll } = args;
				const organized = organizeComponentsByType(registry);

				// Show specific component details
				if (component) {
					const comp = registry.components.find((c) => c.name === component);
					if (!comp) {
						const available = registry.components.map((c) => c.name).join(", ");
						return {
							content: [
								{
									type: "text",
									text: `Component "${component}" not found. Available components: ${available}`,
								},
							],
							isError: true,
						};
					}

					let result = `# ${comp.name}\n\n`;
					result += `**Type:** ${comp.type}\n`;
					result += `**Description:** ${comp.description}\n\n`;

					if (comp.files?.length) {
						result += `**Files:**\n${comp.files.map((f) => `- ${f}`).join("\n")}\n\n`;
					}

					if (comp.dependencies?.length) {
						result += `**Dependencies:** ${comp.dependencies.join(", ")}\n\n`;
					}

					if (comp.registryDependencies?.length) {
						result += `**Registry Dependencies:** ${comp.registryDependencies.join(", ")}\n\n`;
					}

					// Determine the actual component/hook name from files
					const mainFile = comp.files?.[0];
					if (mainFile) {
						const fileName = path.basename(mainFile, path.extname(mainFile));
						result += `**Import:**\n\`\`\`tsx\nimport { ${fileName} } from 'bigblocks';\n\`\`\`\n\n`;
					}

					return { content: [{ type: "text", text: result }] };
				}

				// Search components
				if (search) {
					const searchTerm = search.toLowerCase();
					const matchingComponents = registry.components.filter(
						(comp) =>
							comp.name.toLowerCase().includes(searchTerm) ||
							comp.description.toLowerCase().includes(searchTerm) ||
							comp.type.toLowerCase().includes(searchTerm),
					);

					let result = `# BigBlocks Components Search: "${search}"\n\n`;
					if (matchingComponents.length === 0) {
						result += "No components found matching your search.";
					} else {
						result += `Found ${matchingComponents.length} component(s):\n\n`;
						for (const comp of matchingComponents) {
							result += `## ${comp.name} (${comp.type})\n`;
							result += `${comp.description}\n\n`;
						}
					}

					return { content: [{ type: "text", text: result }] };
				}

				// Filter by category and/or type
				if (category || type) {
					let filtered = registry.components;

					if (category) {
						filtered = filtered.filter((comp) =>
							comp.type.startsWith(`${category}:`),
						);
					}

					if (type) {
						filtered = filtered.filter((comp) =>
							comp.type.includes(`:${type}`),
						);
					}

					let result = `# BigBlocks Components${category ? ` - ${category}` : ""}${type ? ` - ${type}` : ""}\n\n`;

					if (filtered.length === 0) {
						result += "No components found matching your criteria.";
					} else {
						result += `Found ${filtered.length} component(s):\n\n`;
						for (const comp of filtered) {
							result += `## ${comp.name}\n**Type:** ${comp.type}\n**Description:** ${comp.description}\n\n`;
						}
					}

					return { content: [{ type: "text", text: result }] };
				}

				// Show all components organized
				if (showAll) {
					let result = "# BigBlocks Component Registry\n\n";
					result += `**Version:** ${registry.version}\n`;
					result += `**Total Components:** ${registry.components.length}\n\n`;

					for (const [cat, subcats] of Object.entries(organized)) {
						result += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)}s\n\n`;

						for (const [subcat, components] of Object.entries(subcats)) {
							result += `### ${subcat.charAt(0).toUpperCase() + subcat.slice(1)} (${components.length})\n`;

							for (const comp of components) {
								result += `- **${comp.name}**: ${comp.description}\n`;
							}
							result += "\n";
						}
					}

					result +=
						'\n**Get details:** Use {"component": "component-name"} for specific information\n';
					result +=
						'**Filter:** Use {"category": "component", "type": "social"} to filter by type';

					return { content: [{ type: "text", text: result }] };
				}

				// Default: show overview
				const componentCount = Object.values(organized.component || {}).reduce(
					(sum, comps) => sum + comps.length,
					0,
				);
				const hookCount = Object.values(organized.hook || {}).reduce(
					(sum, hooks) => sum + hooks.length,
					0,
				);

				return {
					content: [
						{
							type: "text",
							text: `# BigBlocks Component Registry

**Version:** ${registry.version}
**Total:** ${registry.components.length} items

**Categories:**
- **Components:** ${componentCount} React components
- **Hooks:** ${hookCount} React hooks

**Component Types:**
${Object.keys(organized.component || {})
	.map(
		(type) => `- **${type}**: ${organized.component[type].length} components`,
	)
	.join("\n")}

Use {"showAll": true} to see all components, {"category": "component"} to browse components, or {"component": "name"} for details.`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);
}
