import { linkBrcMarkdown } from "./brc";
import { renderDocsMarkdown } from "./docs";
import {
	AUTH_SERVER_URL,
	GITHUB_URL,
	getAppVersion,
	MCP_ENDPOINT,
	MCP_ENDPOINT_LEGACY,
	MCP_PROTOCOL_LATEST,
	MCP_PROTOCOL_SUPPORTED,
	NPM_URL,
	OAUTH_SCOPES,
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
	installCommands,
	installTargets,
	steps,
	toolCategories,
} from "./site-content";
import { approximateTotal, countTools, getToolCounts } from "./tool-count";

/**
 * Markdown renderings of each page, served through Accept negotiation and at
 * stable `.md` URLs. Generated from the same content the HTML pages use.
 */

function scopeList(): string {
	return OAUTH_SCOPES.map(
		(scope) => `- \`${scope.name}\` — ${scope.description}`,
	).join("\n");
}

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
- Hosted MCP endpoint: ${MCP_ENDPOINT} (Streamable HTTP, OAuth 2.1; ${MCP_ENDPOINT_LEGACY} also answers)
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

## Authentication and scopes

The hosted endpoint is an OAuth 2.1 protected resource. Authorization server: ${AUTH_SERVER_URL}.
Discovery: ${SITE_URL}/.well-known/oauth-protected-resource and ${SITE_URL}/.well-known/oauth-authorization-server.

Scopes:

${scopeList()}

## Key custody

${guarantees.map((item) => `- **${item.title}** — ${linkBrcMarkdown(item.description)}`).join("\n")}

## FAQ

${faq.map((item) => `**${item.q}**\n\n${linkBrcMarkdown(item.a)}`).join("\n\n")}

## More

- Documentation: ${SITE_URL}/docs
- Connect and generate a config: ${SITE_URL}/connect
- Machine-readable index: ${SITE_URL}/llms.txt
- Sitemap: ${SITE_URL}/sitemap.xml
`;
}

export function renderConnectMarkdown(): string {
	return `# Connect to ${SITE_NAME}

Choose hosted access or run BSV MCP on your computer. This page does not collect
private keys, passwords, or wallet backups.

## Hosted connection

1. Add ${MCP_ENDPOINT} as a remote MCP server in your AI client.
2. Choose Connect or Authenticate. Your client opens Sigma Identity for OAuth authorization.
3. Approve access and return to your client. No manual session token is needed.
4. Ask: "Run bsv_status and explain which services are available."

Your client must support Streamable HTTP and OAuth. Sigma verifies your account
and consent, then gives the client a short-lived token for BSV MCP. That token
opens the hosted endpoint; it does not connect your wallet, move funds, or
authorize payments. The authorization server is ${AUTH_SERVER_URL}.

## Run on your computer

Install Bun, then configure your client to launch bunx with arguments
["bsv-mcp@latest", "--stdio"]. To start without keys, set DISABLE_WALLET_TOOLS=true
and DISABLE_BROADCASTING=true in that server's environment. Restart your client
and run bsv_status. A missing wallet is expected for this setup.

## Add a wallet separately

Use local MCP with an existing signer, or initialize an encrypted account in a
terminal. See ${SITE_URL}/docs#wallets. Hosted MCP cannot directly reach a signer
on your computer. Existing accounts should follow the migration instructions.

## Discovery documents

- ${SITE_URL}/.well-known/oauth-protected-resource
- ${SITE_URL}/.well-known/oauth-authorization-server

## Scopes

${scopeList()}

## Self-hosting instead

Run the server locally over stdio with \`${installCommands.stdio}\`, or self-host the
Streamable HTTP transport. See ${GITHUB_URL}.
`;
}

export function renderNotFoundMarkdown(path: string): string {
	return `# 404 — Not found

No page exists at \`${path}\` on ${SITE_URL}.

## Where to look instead

- [Home](${SITE_URL}/) — what ${SITE_NAME} is, the tool catalogue, and install instructions
- [Connect](${SITE_URL}/connect) — choose hosted or local setup
- [llms.txt](${SITE_URL}/llms.txt) — machine-readable index of every documented resource
- [Sitemap](${SITE_URL}/sitemap.xml) — every indexable URL
- [Source](${GITHUB_URL}) — code, README and issue tracker

## Machine-readable endpoints

- MCP (Streamable HTTP): ${MCP_ENDPOINT}
- Protected resource metadata: ${SITE_URL}/.well-known/oauth-protected-resource
- Authorization server metadata: ${SITE_URL}/.well-known/oauth-authorization-server
`;
}

/** Markdown documents addressable by path, used by negotiation and `.md` URLs. */
export const markdownPages: Record<string, () => string> = {
	"/": renderHomeMarkdown,
	"/connect": renderConnectMarkdown,
	"/docs": renderDocsMarkdown,
};
