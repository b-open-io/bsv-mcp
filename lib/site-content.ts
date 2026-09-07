/**
 * The editorial content of the landing page.
 *
 * Kept separate from presentation so the HTML page, the markdown variant and
 * llms.txt all render the same facts from one source.
 */

export interface ToolCategory {
	key: string;
	name: string;
	/** Tool-name prefixes belonging to this category. */
	prefixes: string[];
	/** Individual tools that do not follow this category's prefix. */
	tools?: string[];
	description: string;
}

export const toolCategories: ToolCategory[] = [
	{
		key: "wallet",
		name: "Wallet",
		prefixes: ["wallet"],
		tools: [
			"app_wallet_data",
			"app_sweep_scan",
			"app_sweep_prepare",
			"app_sweep_complete",
		],
		description:
			"Send BSV, manage UTXOs, inscribe files and mint collections from a local key, a BRC-100 signer, or a Droplit-sponsored wallet.",
	},
	{
		key: "ordinals",
		name: "Ordinals",
		prefixes: ["ordinals"],
		tools: ["app_ordinals_data"],
		description:
			"Look up 1Sat Ordinals, browse marketplace listings, and buy or list NFTs directly from a conversation.",
	},
	{
		key: "explorer",
		name: "Explorer",
		prefixes: ["bsv", "x402"],
		tools: ["app_explorer_data"],
		description:
			"Decode raw transactions, fetch blocks and addresses, and pull the live BSV price with built-in caching.",
	},
	{
		key: "identity",
		name: "Identity",
		prefixes: ["bap"],
		description:
			"Create and manage Bitcoin Attestation Protocol (BAP) identities and sign attestations on-chain.",
	},
	{
		key: "social",
		name: "Social",
		prefixes: ["bsocial", "bmap"],
		description:
			"Post, like, and follow on BSocial. Your agent can publish to the open social graph.",
	},
	{
		key: "tokens",
		name: "Tokens",
		prefixes: ["mnee", "utils"],
		description:
			"Check balances and transfer MNEE stablecoin, with utilities for encoding, hashing, and data conversion.",
	},
];

export const steps = [
	{
		title: "Install",
		description:
			"One plugin command for Claude Code, a JSON snippet for Cursor or Claude Desktop, or a hosted URL. No build step.",
	},
	{
		title: "Connect a key",
		description:
			"Connect an existing BRC-100 wallet or initialize a named encrypted account in a local terminal.",
	},
	{
		title: "Ask",
		description:
			"“Inscribe this SVG”, “what's in block 900000”, “send 5000 sats to…”. The agent picks the right tool and shows you the txid.",
	},
];

export const deployModes = [
	{
		key: "local",
		title: "Local",
		subtitle: "stdio transport",
		description:
			"Runs on your machine with an external signer or local keys. Optional encrypted key storage; see the wallet setup docs.",
	},
	{
		key: "http",
		title: "HTTP",
		subtitle: "Streamable HTTP",
		description:
			"Self-host the Streamable HTTP endpoint with OAuth 2.1 and JWT validation.",
	},
	{
		key: "hosted",
		title: "Hosted",
		subtitle: "bsvmcp.com",
		description:
			"Add the hosted URL to your AI client and authorize access through Sigma Identity.",
	},
];

export const guarantees = [
	{
		key: "encrypted",
		title: "Encrypted at rest",
		description:
			"Local accounts use encrypted bitcoin-backup files. Missing keys stop startup; the server never generates a replacement.",
	},
	{
		key: "no-env-passphrase",
		title: "No passphrase env vars",
		description:
			"Passphrases are entered through a temporary local web prompt, never read from the environment.",
	},
	{
		key: "bitcoin-auth",
		title: "Bitcoin-signed auth",
		description:
			"Hosted mode uses OAuth 2.1 via sigma-auth. Your public key is your identity. Nothing to register.",
	},
	{
		key: "external-signer",
		title: "External signers",
		description:
			"Point at a BRC-100 wallet and it stays the permission authority. Every spend is approved there.",
	},
];

export const clients = [
	"Claude Code",
	"Claude Desktop",
	"Cursor",
	"Codex",
	"Grok Build",
	"opencode",
	"Any MCP client",
];

export const installCommands = {
	claudeCode: "claude plugin install bsv-mcp@b-open-io",
	stdio: "bunx bsv-mcp@latest --stdio",
};

export const clientConfig = `{
  "mcpServers": {
    "bsv-mcp": {
      "command": "bunx",
      "args": ["bsv-mcp@latest", "--stdio"]
    }
  }
}`;

export interface InstallCommand {
	label: string;
	command: string;
}

export interface InstallTarget {
	key: string;
	label: string;
	/** Primary shell command, when the client has a CLI. */
	command?: string;
	/** Further commands for the same client, each with its own label. */
	altCommands?: InstallCommand[];
	/** Where the config below belongs on disk. */
	configPath?: string;
	config?: string;
	note?: string;
	docsUrl: string;
}

const STDIO_JSON = `{
  "mcpServers": {
    "bsv-mcp": {
      "command": "bunx",
      "args": ["bsv-mcp@latest", "--stdio"]
    }
  }
}`;

const STDIO_TOML = `[mcp_servers.bsv-mcp]
command = "bunx"
args = ["bsv-mcp@latest", "--stdio"]`;

/**
 * Per-client install instructions.
 *
 * Every entry comes from that client's official MCP documentation. Clients
 * whose syntax could not be verified are deliberately absent rather than
 * guessed: pi is omitted because it has no MCP support by design, and Claude
 * Desktop shows only the local form because its documented config file covers
 * local servers, with remote servers added through its Connectors UI.
 */
export const installTargets: InstallTarget[] = [
	{
		key: "claude-code",
		label: "Claude Code",
		command: "claude plugin install bsv-mcp@b-open-io",
		altCommands: [
			{
				label: "Or register the local server yourself",
				command:
					"claude mcp add --transport stdio bsv-mcp -- bunx bsv-mcp@latest --stdio",
			},
			{
				label: "Or use the hosted server",
				command: "claude mcp add --transport http bsv-mcp https://bsvmcp.com",
			},
		],
		note: "The plugin bundles the server and registers it automatically, so no config file is needed.",
		docsUrl: "https://code.claude.com/docs/en/mcp",
	},
	{
		key: "claude-desktop",
		label: "Claude Desktop",
		configPath:
			"~/Library/Application Support/Claude/claude_desktop_config.json",
		config: STDIO_JSON,
		note: "Restart Claude Desktop after editing. On Windows the file lives under %APPDATA%\\Claude. Remote servers are added through the Connectors UI rather than this file.",
		docsUrl:
			"https://modelcontextprotocol.io/docs/develop/connect-local-servers",
	},
	{
		key: "cursor",
		label: "Cursor",
		configPath: ".cursor/mcp.json",
		config: STDIO_JSON,
		docsUrl: "https://docs.cursor.com/context/model-context-protocol",
	},
	{
		key: "codex",
		label: "Codex",
		command: "codex mcp add bsv-mcp -- bunx bsv-mcp@latest --stdio",
		configPath: "~/.codex/config.toml",
		config: STDIO_TOML,
		note: "The command and the config file are equivalent. Codex reads TOML, not JSON.",
		docsUrl: "https://learn.chatgpt.com/docs/extend/mcp?surface=cli",
	},
	{
		key: "grok",
		label: "Grok Build",
		command: "grok mcp add bsv-mcp -- bunx bsv-mcp@latest --stdio",
		altCommands: [
			{
				label: "Or use the hosted server",
				command: "grok mcp add --transport http bsv-mcp https://bsvmcp.com",
			},
		],
		configPath: "~/.grok/config.toml",
		config: STDIO_TOML,
		docsUrl: "https://docs.x.ai/build/features/mcp-servers",
	},
	{
		key: "opencode",
		label: "opencode",
		configPath: "opencode.json",
		config: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "bsv-mcp": {
      "type": "local",
      "command": ["bunx", "bsv-mcp@latest", "--stdio"],
      "enabled": true
    }
  }
}`,
		docsUrl: "https://opencode.ai/docs/mcp-servers/",
	},
	{
		key: "other",
		label: "Any MCP client",
		command: "bunx bsv-mcp@latest --stdio",
		note: "Any client that speaks MCP over stdio can run the server directly. For Streamable HTTP, point it at https://bsvmcp.com and authenticate with OAuth 2.1.",
		docsUrl: "https://modelcontextprotocol.io",
	},
];

/**
 * Hero copy. The headline must answer "what is this" on its own; the sub
 * carries the specifics that make it believable.
 */
export const hero = {
	eyebrow: "open source",
	headline: "The Bitcoin SV wallet for MCP clients.",
	sub: "Tools that let Claude, Cursor or any agent send BSV, inscribe ordinals and read the chain. No SDK code. One command, hosted or local.",
};

/** Problem before solution: what an agent developer does without this. */
export const problem = {
	without: [
		"Hand-wire the SDK into every agent you build",
		"Manage keys, UTXOs and fees yourself",
		"Re-implement broadcasting for each client",
	],
	with: [
		"One MCP server, every client",
		"Keys encrypted at rest or held by your own signer",
		"Ask in plain language, get a txid",
	],
};

/** The objections a developer raises before installing anything. */
export const faq = [
	{
		q: "Does it work with my client?",
		a: "Anything that speaks MCP. Claude Code, Claude Desktop, Cursor, Codex, Grok Build and opencode are documented above with their exact config; any other stdio client runs it with bunx bsv-mcp@latest --stdio.",
	},
	{
		q: "Where are my keys?",
		a: "Use an external BRC-100 signer or a named encrypted account. Run init in a local terminal and back up the account before funding it.",
	},
	{
		q: "Is it maintained?",
		a: "Yes. The changelog on GitHub is the record of what shipped.",
	},
	{
		q: "Can I read the code first?",
		a: "All of it. MIT licensed, on GitHub. The tool count is a release snapshot; available tools depend on your wallet mode and enabled categories.",
	},
];
