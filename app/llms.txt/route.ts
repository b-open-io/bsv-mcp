import {
	GITHUB_URL,
	getAppVersion,
	MCP_PROTOCOL_LATEST,
	NPM_URL,
	SITE_DESCRIPTION,
	SITE_NAME,
	SITE_URL,
} from "@/lib/site";
import { toolCategories } from "@/lib/site-content";
import { approximateTotal, countTools, getToolCounts } from "@/lib/tool-count";

/**
 * llms.txt — a machine-readable index of this site, per llmstxt.org.
 *
 * Generated from the same constants the pages use so it cannot go stale.
 */
export async function GET() {
	const counts = getToolCounts();
	const total = approximateTotal(counts.total);

	const categories = toolCategories
		.map((category) => {
			const count = countTools(counts, category.key);
			const suffix = count > 0 ? ` (${count} tools)` : "";
			return `- ${category.name}${suffix}: ${category.description}`;
		})
		.join("\n");

	const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} is version ${getAppVersion()} and speaks MCP protocol ${MCP_PROTOCOL_LATEST}.
Your AI client runs it locally over stdio. Local use needs no account sign-in. Every page on this site is also available as
markdown by sending \`Accept: text/markdown\`, or by appending \`.md\` to the path.

## Docs

- [Home](${SITE_URL}/index.md): what ${SITE_NAME} is, the tool catalogue, install instructions and deployment modes
- [All tools](${SITE_URL}/docs/tools.md): searchable catalog with individual tool inputs, results, permissions and wallet availability
- [Documentation](${SITE_URL}/docs.md): wallet setup, backend configuration, tools, sponsorship, delegation and troubleshooting
- [README](${GITHUB_URL}#readme): quick start and source
- [Changelog](${GITHUB_URL}/blob/master/CHANGELOG.md): release history

## Tools

${categories}
${total ? `\nTools in the release catalog (availability depends on configuration): ${total}.\n` : ""}
## Optional

- [Source](${GITHUB_URL}): issue tracker and contribution guide
- [Package](${NPM_URL}): published npm package
- [Sitemap](${SITE_URL}/sitemap.xml): every indexable URL
`;

	return new Response(body, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
			"Access-Control-Allow-Origin": "*",
		},
	});
}
