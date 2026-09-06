import {
	AUTH_SERVER_URL,
	GITHUB_URL,
	getAppVersion,
	MCP_ENDPOINT,
	MCP_PROTOCOL_LATEST,
	NPM_URL,
	OAUTH_SCOPES,
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

	const scopes = OAUTH_SCOPES.map(
		(scope) => `- \`${scope.name}\`: ${scope.description}`,
	).join("\n");

	const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} is version ${getAppVersion()} and speaks MCP protocol ${MCP_PROTOCOL_LATEST}.
It runs three ways: locally over stdio, self-hosted over Streamable HTTP, or as
the hosted service on this domain. Every page on this site is also available as
markdown by sending \`Accept: text/markdown\`, or by appending \`.md\` to the path.

## Docs

- [Home](${SITE_URL}/index.md): what ${SITE_NAME} is, the tool catalogue, install instructions and deployment modes
- [Connect](${SITE_URL}/connect.md): generate or import a Bitcoin key and get a client configuration
- [README](${GITHUB_URL}#readme): full installation and configuration reference
- [Changelog](${GITHUB_URL}/blob/master/CHANGELOG.md): release history

## API

- [MCP endpoint](${MCP_ENDPOINT}): Streamable HTTP transport, OAuth 2.1 protected
- [Protected resource metadata](${SITE_URL}/.well-known/oauth-protected-resource): RFC 9728, declares supported scopes
- [Authorization server metadata](${SITE_URL}/.well-known/oauth-authorization-server): RFC 8414 endpoints for ${AUTH_SERVER_URL}

## Scopes

${scopes}

## Tools

${categories}
${total ? `\nTools registered by default: ${total}.\n` : ""}
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
