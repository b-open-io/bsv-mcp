import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	LATEST_PROTOCOL_VERSION,
	SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Canonical facts about this site, in one place.
 *
 * The landing page, the markdown variants, llms.txt, robots.txt, the sitemap
 * and the OAuth metadata all read from here, so a fact cannot be right in one
 * surface and stale in another.
 */

export const SITE_NAME = "BSV MCP";

// Deliberately not derived from RESOURCE_URL: that names the OAuth protected
// resource for token validation and can legitimately differ from the public
// site (it currently points at the older vercel.app hostname).
export const SITE_URL = (
	process.env.NEXT_PUBLIC_SITE_URL ?? "https://bsvmcp.com"
).replace(/\/$/, "");

export const SITE_TAGLINE = "Bitcoin SV tools for AI agents";

export const SITE_DESCRIPTION =
	"An open source Model Context Protocol server that gives Claude, Cursor, and any MCP client a Bitcoin SV wallet: send BSV, inscribe ordinals, manage identity, and read the chain.";

export const GITHUB_URL = "https://github.com/b-open-io/bsv-mcp";
export const NPM_URL = "https://www.npmjs.com/package/bsv-mcp";
export const MCP_SPEC_URL = "https://modelcontextprotocol.io";

/** The hosted Streamable HTTP endpoint MCP clients connect to. */
export const MCP_ENDPOINT = `${SITE_URL}/api/mcp`;

/** The OAuth 2.1 authorization server that issues tokens for this resource. */
export const AUTH_SERVER_URL =
	process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com";

/**
 * MCP protocol revisions this server speaks, taken from the SDK rather than
 * written down. `LATEST` is what a client negotiates by default; the older
 * revisions remain accepted for backwards compatibility.
 */
export const MCP_PROTOCOL_LATEST = LATEST_PROTOCOL_VERSION;
export const MCP_PROTOCOL_SUPPORTED = [
	...SUPPORTED_PROTOCOL_VERSIONS,
] as string[];

/** Reads the published package version so the UI never states a stale one. */
export function getAppVersion(): string {
	try {
		const pkg = JSON.parse(
			readFileSync(join(process.cwd(), "package.json"), "utf8"),
		) as { version?: string };
		return pkg.version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}

/**
 * Scopes this resource understands, declared so agents can request least
 * privilege instead of asking for everything. Published in the RFC 9728
 * protected-resource metadata and documented for humans on the site.
 */
export const OAUTH_SCOPES: { name: string; description: string }[] = [
	{ name: "openid", description: "Authenticate and identify the user." },
	{ name: "profile", description: "Read the user's basic profile." },
	{ name: "email", description: "Read the user's email address." },
	{
		name: "offline_access",
		description: "Refresh access without re-prompting the user.",
	},
	{
		name: "bsv:tools",
		description: "Call read-only blockchain and utility tools.",
	},
	{
		name: "bsv:wallet",
		description: "Read wallet state and create signed transactions.",
	},
	{
		name: "bsv:ordinals",
		description: "Read, inscribe, list and buy 1Sat Ordinals.",
	},
	{ name: "bsv:tokens", description: "Read and transfer token balances." },
];

export const OAUTH_SCOPE_NAMES = OAUTH_SCOPES.map((scope) => scope.name);
