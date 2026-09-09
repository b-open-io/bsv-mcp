import { linkBrcMarkdown } from "./brc";
import { renderDocsMarkdown } from "./docs";
import {
	GITHUB_URL,
	getAppVersion,
	MCP_PROTOCOL_LATEST,
	MCP_PROTOCOL_SUPPORTED,
	NPM_URL,
	SITE_DESCRIPTION,
	SITE_NAME,
	SITE_TAGLINE,
	SITE_URL,
} from "./site";
import {
	clients,
	deployModes,
	faq,
	guarantees,
	installTargets,
	steps,
	toolCategories,
} from "./site-content";
import { approximateTotal, countTools, getToolCounts } from "./tool-count";
import { toolMarkdownPages } from "./tool-reference-markdown";

/**
 * Markdown renderings of each page, served through Accept negotiation and at
 * stable `.md` URLs. Generated from the same content the HTML pages use.
 */

/** Renders every documented client's install instructions. */
function renderInstallTargets(): string {
	return installTargets
		.map((target) => {
			const parts: string[] = [`### ${target.label}`];

			if (target.command) {
				parts.push(`\`\`\`bash\n${target.command}\n\`\`\``);
			}
			for (const alt of target.altCommands ?? []) {
				parts.push(`${alt.label}:\n\n\`\`\`bash\n${alt.command}\n\`\`\``);
			}
			if (target.config) {
				const language = target.configPath?.endsWith(".toml") ? "toml" : "json";
				if (target.configPath) parts.push(`\`${target.configPath}\`:`);
				parts.push(`\`\`\`${language}\n${target.config}\n\`\`\``);
			}
			if (target.note) parts.push(target.note);
			parts.push(`Docs: ${target.docsUrl}`);

			return parts.join("\n\n");
		})
		.join("\n\n");
}

export function renderHomeMarkdown(): string {
	const counts = getToolCounts();
	const total = approximateTotal(counts.total);

	const categories = toolCategories
		.map((category) => {
			const count = countTools(counts, category.key);
			const suffix = count > 0 ? ` (${count} tools)` : "";
			return `### ${category.name}${suffix}\n\n${linkBrcMarkdown(category.description)}`;
		})
		.join("\n\n");

	return `# ${SITE_NAME} — ${SITE_TAGLINE}

> ${SITE_DESCRIPTION}

- Version: ${getAppVersion()}
- MCP protocol: ${MCP_PROTOCOL_LATEST} (also accepts ${MCP_PROTOCOL_SUPPORTED.join(", ")})
- Connection: local stdio; no account sign-in required
- Source: ${GITHUB_URL}
- Package: ${NPM_URL}

## Install

${renderInstallTargets()}

Works with ${clients.join(", ")}.

## How it works

${steps.map((step, index) => `${index + 1}. **${step.title}** — ${linkBrcMarkdown(step.description)}`).join("\n")}

## Tools

${categories}

${total ? `Tools in the release catalog (availability depends on configuration): ${total}.` : ""}

## Deployment modes

${deployModes.map((mode) => `- **${mode.title}** (${mode.subtitle}) — ${linkBrcMarkdown(mode.description)}`).join("\n")}

## Key custody

${guarantees.map((item) => `- **${item.title}** — ${linkBrcMarkdown(item.description)}`).join("\n")}

## FAQ

${faq.map((item) => `**${item.q}**\n\n${linkBrcMarkdown(item.a)}`).join("\n\n")}

## More

- Documentation: ${SITE_URL}/docs
- Tool reference: ${SITE_URL}/docs/tools
- Machine-readable index: ${SITE_URL}/llms.txt
- Sitemap: ${SITE_URL}/sitemap.xml
`;
}

export function renderConnectMarkdown(): string {
	return `# Connect to ${SITE_NAME}

Install Bun to run the server and Node.js for npx. Configure your AI client to launch the local server:

\`\`\`sh
npx -y bsv-mcp@latest --stdio
\`\`\`

No Sigma account or OAuth sign-in is required. Open local wallet setup to create,
import or unlock a Vault, or connect an external BRC-100 wallet.

- [Installation](${SITE_URL}/docs#quickstart)
- [Wallet setup](${SITE_URL}/docs#wallets)
- [All tools](${SITE_URL}/docs/tools)
`;
}

export function renderNotFoundMarkdown(path: string): string {
	return `# 404 — Not found

No page exists at \`${path}\` on ${SITE_URL}.

## Where to look instead

- [Home](${SITE_URL}/) — what ${SITE_NAME} is, the tool catalogue, and install instructions
- [Documentation](${SITE_URL}/docs) — local installation and wallet setup
- [All tools](${SITE_URL}/docs/tools) — inputs, results and wallet requirements
- [llms.txt](${SITE_URL}/llms.txt) — machine-readable index of every documented resource
- [Sitemap](${SITE_URL}/sitemap.xml) — every indexable URL
- [Source](${GITHUB_URL}) — code, README and issue tracker

`;
}

/** Markdown documents addressable by path, used by negotiation and `.md` URLs. */
export const markdownPages: Record<string, () => string> = {
	...toolMarkdownPages,
	"/": renderHomeMarkdown,
	"/connect": renderConnectMarkdown,
	"/docs": renderDocsMarkdown,
};
