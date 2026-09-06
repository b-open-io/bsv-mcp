/**
 * The editorial content of the landing page.
 *
 * Kept separate from presentation so the HTML page, the markdown variant and
 * llms.txt all render the same facts from one source.
 */

export interface ToolCategory {
	key: string;
	name: string;
	/** `tools/` directories whose registrations belong to this category. */
	directories: string[];
	description: string;
}

export const toolCategories: ToolCategory[] = [
	{
		key: "wallet",
		name: "Wallet",
		directories: ["wallet"],
		description:
			"Send BSV, manage UTXOs, inscribe files and mint collections from a local key, a BRC-100 signer, or a Droplit-sponsored wallet.",
	},
	{
		key: "ordinals",
		name: "Ordinals",
		directories: ["ordinals"],
		description:
			"Look up 1Sat Ordinals, browse marketplace listings, and buy or list NFTs directly from a conversation.",
	},
	{
		key: "explorer",
		name: "Explorer",
		directories: ["bsv"],
		description:
			"Decode raw transactions, fetch blocks and addresses, and pull the live BSV price with built-in caching.",
	},
	{
		key: "identity",
		name: "Identity",
		directories: ["bap"],
		description:
			"Create and manage Bitcoin Attestation Protocol (BAP) identities and sign attestations on-chain.",
	},
	{
		key: "social",
		name: "Social",
		directories: ["bsocial"],
		description:
			"Post, like, and follow on BSocial. Your agent can publish to the open social graph.",
	},
	{
		key: "tokens",
		name: "Tokens",
		directories: ["mnee", "utils"],
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
			"Bring a WIF, point at an existing BRC-100 wallet, or let the server generate an encrypted key on first run.",
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
			"Runs on your machine with keys encrypted at rest. The default for Claude Code and desktop clients.",
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
			"Authenticate with a Bitcoin signature and get a ready-to-paste config. Nothing to run.",
	},
];

export const guarantees = [
	{
		key: "encrypted",
		title: "Encrypted at rest",
		description:
			"AES-256-GCM with 600k PBKDF2 iterations in the bitcoin-backup format. Files are created with 0600 permissions.",
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
	stdio: "bunx bsv-mcp@latest",
};

export const clientConfig = `{
  "mcpServers": {
    "bsv-mcp": {
      "command": "bunx",
      "args": ["bsv-mcp@latest"]
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
      "args": ["bsv-mcp@latest"]
    }
  }
}`;

const STDIO_TOML = `[mcp_servers.bsv-mcp]
command = "bunx"
args = ["bsv-mcp@latest"]`;

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
					"claude mcp add --transport stdio bsv-mcp -- bunx bsv-mcp@latest",
			},
			{
				label: "Or use the hosted server",
				command:
					"claude mcp add --transport http bsv-mcp https://bsvmcp.com/api/mcp",
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
		command: "codex mcp add bsv-mcp -- bunx bsv-mcp@latest",
		configPath: "~/.codex/config.toml",
		config: STDIO_TOML,
		note: "The command and the config file are equivalent. Codex reads TOML, not JSON.",
		docsUrl: "https://learn.chatgpt.com/docs/extend/mcp?surface=cli",
	},
	{
		key: "grok",
		label: "Grok Build",
		command: "grok mcp add bsv-mcp -- bunx bsv-mcp@latest",
		altCommands: [
			{
				label: "Or use the hosted server",
				command:
					"grok mcp add --transport http bsv-mcp https://bsvmcp.com/api/mcp",
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
      "command": ["bunx", "bsv-mcp@latest"],
      "enabled": true
    }
  }
}`,
		docsUrl: "https://opencode.ai/docs/mcp-servers/",
	},
	{
		key: "other",
		label: "Any MCP client",
		command: "bunx bsv-mcp@latest",
		note: "Any client that speaks MCP over stdio can run the server directly. For Streamable HTTP, point it at https://bsvmcp.com/api/mcp and authenticate with OAuth 2.1.",
		docsUrl: "https://modelcontextprotocol.io",
	},
];
