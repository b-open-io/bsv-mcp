import { linkBrcMarkdown } from "./brc";
import { SITE_URL } from "./site";

interface DocTopic {
	title: string;
	paragraphs: string[];
	code?: string;
}
export interface DocSection extends DocTopic {
	id: string;
	topics?: DocTopic[];
	links?: { label: string; href: string }[];
}

/** Shared by the website and its Markdown representation. */
export const docs: DocSection[] = [
	{
		id: "quickstart",
		title: "Start here",
		paragraphs: [
			"BSV MCP lets an AI assistant use Bitcoin SV tools. You can ask it to check a transaction, show your wallet balance, send a payment, or create an ordinal: content such as an image recorded on the blockchain.",
			"Start by connecting BSV MCP to your AI client. The examples below use a server running on your computer. Hosted access is available on the connection page.",
		],
		links: [
			{
				label: "Client-specific installation",
				href: "/#install",
			},
			{
				label: "Connect hosted server",
				href: "/connect",
			},
		],
		topics: [
			{
				title: "1. Add the server",
				paragraphs: [
					"Install Bun, then run the command for your client in a terminal. These examples start without a wallet and disable broadcasting. You only need one command.",
				],
				code: "# Codex\ncodex mcp add bsv-mcp --env DISABLE_WALLET_TOOLS=true --env DISABLE_BROADCASTING=true -- bunx bsv-mcp@latest --stdio\n\n# Claude Code\nclaude mcp add --env DISABLE_WALLET_TOOLS=true --env DISABLE_BROADCASTING=true --transport stdio bsv-mcp -- bunx bsv-mcp@latest --stdio",
			},
			{
				title: "2. Connect a wallet",
				paragraphs: [
					"When you need funds, choose a wallet option below, remove DISABLE_WALLET_TOOLS and DISABLE_BROADCASTING from the server configuration, and restart your client. The tools available to you depend on that choice and the tool groups enabled on your server.",
				],
			},
			{
				title: "3. Check the connection",
				paragraphs: [
					'Ask your assistant: "Run bsv_status and explain whether my wallet and 1Sat service are available."',
					"This check reports the server configuration and contacts the 1Sat capabilities endpoint, which lists enabled API services. It does not sign transactions, spend funds, or import deposits. A successful check does not verify every wallet operation.",
				],
			},
		],
	},
	{
		id: "wallets",
		title: "Choose your wallet",
		paragraphs: [
			"BSV MCP can connect to an existing wallet or manage keys locally. An existing wallet handles signing: approving a transaction with its private keys.",
		],
		links: [
			{
				label: "Account files and migration details",
				href: "https://github.com/b-open-io/bsv-mcp/blob/master/docs/keys.md",
			},
			{
				label: "External signer setup",
				href: "https://github.com/b-open-io/bsv-mcp/blob/master/docs/external-signer.md",
			},
		],
		topics: [
			{
				title: "Connect an existing wallet",
				paragraphs: [
					"Your wallet must expose the BSV SDK HTTPWalletJSON interface, an API for wallet requests. Set BRC100_WALLET_URL to that API address. The wallet controls permissions and keeps its keys; BSV MCP does not create local or remote wallet storage in this mode.",
					"Add the following variables to your MCP server environment, replace the wallet URL with your own, then restart the server. BSV_CHAIN must match the wallet network: main for mainnet or test for testnet.",
				],
				code: "BRC100_WALLET_URL=http://127.0.0.1:3321\nBRC100_WALLET_ORIGINATOR=bsv-mcp.local\nBSV_CHAIN=main",
			},
			{
				title: "Set up an encrypted account",
				paragraphs: [
					"Run bsv-mcp init in a local terminal. Choose a network, create or import a key, and enter an encryption password twice. The command shows only a public address. Back up the encrypted files before funding the wallet. Never paste private keys or passwords into chat.",
					"Each account lives in ~/.bsv-mcp/accounts/<name>/ and has config.json, encrypted keys.bep, and wallet-main.db or wallet-test.db. BSV_MCP_ACCOUNT selects an account; the default name is default. Supply BSV_MCP_PASSWORD in the server process environment to unlock it. PRIVATE_KEY_WIF remains an explicit environment override. A missing key, invalid key or bad password stops startup without generating a replacement.",
					"Wallet storage is local by default. The account configuration can set activeRemote and backups; REMOTE_STORAGE_URL overrides the active remote. Wallet storage must be compatible with the 1Sat wallet SDK. These settings are separate from blockchain lookup services.",
				],
				code: "bunx bsv-mcp@latest init --account default\nbunx bsv-mcp@latest wallet_list\n# Configure BSV_MCP_PASSWORD locally, then start:\nBSV_MCP_ACCOUNT=default bunx bsv-mcp@latest --stdio",
			},
			{
				title: "Manage and migrate accounts",
				paragraphs: [
					"wallet_list reports public addresses without unlocking accounts. wallet_generate and wallet_import create encrypted named accounts after human approval. WIF import is terminal-only; the MCP import tool accepts an encrypted backup. wallet_use returns the account environment setting: restart the MCP server to apply it. wallet_remove requires force, a verified backup and human confirmation because funds may exist on other derived addresses.",
					"Existing plaintext keys are migration inputs only. Stop the old wallet process, then run wallet_migrate in a terminal. Migration verifies the encrypted copy and preserves the lab storage identity and database. It leaves the source in place unless you explicitly request --erase-source after verification and backup. Overwriting a file cannot guarantee erasure from SSD snapshots or backups.",
				],
				code: "bunx bsv-mcp@latest wallet_migrate --source legacy --account default\nbunx bsv-mcp@latest wallet_migrate --source sigma-lab --account sigma-lab",
			},
			{
				title: "Run the bundled external signer",
				paragraphs: [
					"signer-serve unlocks one named account and starts an MCP child with a private loopback signer connection. The child receives no private-key or password variables. The signer checks the secret request path, Origin and SDK method before handling a request. It requires terminal approval for createAction and signAction; those calls fail closed when a headless client has no terminal. An existing signer with its own approval UI is the better fit for payments from a headless MCP host.",
				],
				code: "bunx bsv-mcp@latest signer-serve --account sigma-lab",
			},
			{
				title: "Existing-wallet connection rules",
				paragraphs: [
					"Use the wallet signing API address. The /1sat/wallet endpoint and the storage endpoint exposed by 1sat serve wallet store wallet data; they cannot act as BRC100_WALLET_URL.",
					"The wallet URL must use HTTPS, or HTTP on the local computer. Credentials, query strings, fragments, and redirects are rejected. Startup requests the wallet identity public key once and stops if the request fails or takes more than 10 seconds. Wallet calls are not automatically retried.",
					"BRC100_WALLET_ORIGINATOR defaults to bsv-mcp.local. Use a domain or HTTP(S) origin without credentials, paths, queries or fragments. Empty, malformed, and admin.bsv-mcp.internal origins are rejected. Remove PRIVATE_KEY_WIF and IDENTITY_KEY_WIF and leave USE_DROPLIT_API unset when using an external signer. The explicit sponsor pair described below can be used alongside the signer.",
				],
			},
		],
	},
	{
		id: "backends",
		title: "Configure your infrastructure",
		paragraphs: [
			"You can use the public services with their default settings. To run your own infrastructure, set the URLs below in the MCP server environment and restart it. Each replacement must support the same API as the service it replaces.",
		],
		links: [
			{
				label: "Live 1Sat modules",
				href: "https://api.1sat.app/1sat/capabilities",
			},
			{
				label: "1Sat API dashboard",
				href: "https://api.1sat.app/1sat/home/",
			},
			{
				label: "1Sat SDK",
				href: "https://github.com/b-open-io/1sat-sdk",
			},
			{
				label: "1Sat stack source",
				href: "https://github.com/b-open-io/1sat-stack",
			},
		],
		topics: [
			{
				title: "Change the 1Sat service",
				paragraphs: [
					"ONESAT_API_URL controls blockchain lookups and local-wallet services, including transaction submission. It defaults to https://api.1sat.app on mainnet and https://testnet.api.1sat.app on testnet. An existing wallet continues to use its own storage and transaction submission services.",
					"Set the base URL without /1sat. The SDK adds that path. If PUBLIC_ORDFS_URL is unset, its default follows this base URL. Wallet remote storage is configured separately.",
				],
				code: "# Example: a 1Sat stack running locally\nONESAT_API_URL=http://127.0.0.1:8080",
			},
			{
				title: "Configure services separately",
				paragraphs: [
					"EXPLORER_API_URL selects the explorer API used for blockchain lookups and prices. BananaBlocks is the mainnet default. JUNGLEBUS_API_URL supplies transaction decoding and legacy raw/BEEF reads. ORDINALS_API_URL remains for legacy sweep and token-listing data; marketplace browsing now uses 1Sat. Each tool uses its configured service; it does not automatically switch to another provider if that service fails.",
					"Set EXPLORER_API_URL to a compatible API base without the final /main or /test; BSV MCP appends the selected network. BananaBlocks uses /api/v1/bsv. WhatsOnChain uses /v1/bsv. Testnet still defaults to WhatsOnChain because the public BananaBlocks API documents a mainnet mirror. The older WOC_API_URL setting still works when EXPLORER_API_URL is unset.",
					"PUBLIC_ORDFS_URL overrides the content base used in generated links and dashboard previews. PUBLIC_BMAP_URL, BSOCIAL_API_URL, V5_API_URL and A2B_API_URL configure optional legacy social and discovery integrations. MNEE uses its SDK's own service configuration. DROPLIT_API_URL and OAUTH_ISSUER configure sponsorship and authentication separately.",
				],
				code: "# Defaults for mainnet\nONESAT_API_URL=https://api.1sat.app\nEXPLORER_API_URL=https://bananablocks.com/api/v1/bsv\nJUNGLEBUS_API_URL=https://junglebus.gorillapool.io/v1\nORDINALS_API_URL=https://ordinals.gorillapool.io/api\nPUBLIC_ORDFS_URL=https://api.1sat.app/content",
			},
			{
				title: "Check which 1Sat services are enabled",
				paragraphs: [
					"The /1sat/capabilities endpoint lists the services enabled on a deployment. These can include marketplace data, token balances, identity records, file content, and transaction submission. Self-hosted deployments may enable fewer services.",
					"A service appearing in this list does not automatically enable a corresponding MCP tool. The admin entry also does not grant permission to administer the server.",
				],
			},
			{
				title: "Route requests through a proxy",
				paragraphs: [
					"Most API routes begin with /1sat. File content uses /content/{outpoint}; file metadata uses /1sat/ordfs/metadata/{outpoint}. An outpoint identifies one transaction output, written as a transaction ID followed by its output number.",
					"Owner output and synchronization routes use server-sent events (SSE), a stream of responses. Raw transaction endpoints and BEEF endpoints return binary data. BEEF packages transactions with their supporting proof data. Preserve these response formats in your proxy. The SDK submits transactions through /1sat/tx.",
				],
			},
		],
	},
	{
		id: "tools",
		title: "Common tasks",
		paragraphs: [
			"Ask your assistant for the task you want to complete. The tool names below help you check what it is calling. Exact arguments are listed in the tool definitions returned by your installed server.",
		],
		topics: [
			{
				title: "Check your balance or a transaction",
				paragraphs: [
					'Ask: "Show my BSV balance and the ordinals in my wallet."',
					"wallet_getBalance reports funds. wallet_getOrdinals lists ordinals, wallet_getBsv21Balances reports token balances, and wallet_getLockData reports locked funds.",
					"To inspect the blockchain, use bsv_explore for addresses, blocks, and transactions. bsv_decodeTransaction reads a transaction ID or transaction data encoded as hex or base64.",
				],
			},
			{
				title: "Receive a payment",
				paragraphs: [
					'Ask: "Give me a deposit address, then check for incoming funds."',
					"wallet_getAddress returns the deposit address. After the payment arrives, wallet_refreshUtxos imports deposits found by the blockchain indexer into the wallet. The indexer is the service that tracks blockchain activity. Your wallet balance may lag behind the on-chain balance until indexing and import finish.",
				],
			},
			{
				title: "Browse listings and recent sales",
				paragraphs: [
					'Ask: "Find 20 active listings whose names start with cat."',
					"ordinals_marketListings searches active listings; ordinals_marketSales searches completed sales. The q argument matches the beginning of a name. Use type to filter by content type, such as image/png.",
					"The limit is 1–100 results. To get another page, pass the response's nextFrom value as from. A null nextFrom means there are no more pages. Results can change between requests.",
				],
				code: '// Arguments for ordinals_marketListings\n{"q":"cat","limit":20}',
			},
			{
				title: "Find assets belonging to an address",
				paragraphs: [
					"ordinals_searchInscriptions accepts an index key. For an address, use own: followed by the address. Other supported keys include ev:EVENT and tp:TOPIC. This tool searches indexed unspent transaction outputs; results can include available inscription, origin, and MAP metadata. It does not support full-text search or guarantee that every result is an NFT.",
					"Use ordinals_getInscription to read an inscription's metadata. Lookup tools accept outpoints written as txid.vout or txid_vout. The historically named ordinals_getTokenByIdOrTicker currently accepts token IDs only.",
				],
				code: '// Arguments for ordinals_searchInscriptions\n// Replace YOUR_ADDRESS with the address to look up.\n{"key":"own:YOUR_ADDRESS","limit":20}',
			},
			{
				title: "Send funds or create an ordinal",
				paragraphs: [
					"wallet_sendBsv sends to addresses or paymail recipients and accepts BSV or USD amounts. wallet_createOrdinals records content on-chain; it takes the content encoded as base64 and a MIME type, such as image/png.",
					"wallet_transferOrdToken transfers an ordinal using its wallet tracking ID, or BSV21 tokens using a token ID and integer amount. Transfers, listings, purchases, cancellations, and locking or unlocking funds create transactions and may incur fees.",
				],
			},
		],
	},
	{
		id: "tool-settings",
		title: "Advanced tool settings",
		paragraphs: [
			"Use this section when configuring which tools an assistant can call or building custom transactions.",
		],
		topics: [
			{
				title: "Enable or disable tool groups",
				paragraphs: [
					"Tool groups can be disabled with DISABLE_BSV_TOOLS, DISABLE_ORDINALS_TOOLS, DISABLE_WALLET_TOOLS, DISABLE_BAP_TOOLS, DISABLE_BSOCIAL_TOOLS, DISABLE_MNEE_TOOLS and DISABLE_UTILS_TOOLS=true. A2B requires ENABLE_A2B_TOOLS=true. DISABLE_BROADCASTING=true blocks guarded transaction operations. This does not replace the signer's permissions.",
					"External signer mode supports context wallet and BRC-100 tools. Legacy collection minting/gathering, A2B publication, BAP/raw-key, BSocial and MNEE tools are unavailable in that mode. An advertised backend module does not automatically enable a tool group.",
				],
			},
			{
				title: "Build custom transactions",
				paragraphs: [
					"wallet_createAction, wallet_signAction, and wallet_abortAction let you create, sign, and cancel a pending wallet action. Custom inputs require BEEF data containing the supporting transactions and proofs. These tools do not provide a universal quote or dry-run feature.",
					"If a request times out after submission, inspect wallet_listActions and the transaction status before sending it again. The first request may already have succeeded.",
				],
			},
		],
	},
	{
		id: "x402",
		title: "Pay for an online service",
		paragraphs: [
			"BSV MCP can request a service, read its price, and pay with the connected wallet after you authorize the purchase. The service can be a paid API, a file download, an agent, or an account upgrade. x402 itself does not require an API key.",
			"The client takes the service URL and request details directly. There is no default vendor or required payment account. Services that separately require authentication can use wallet identity or optional service credentials.",
		],
		topics: [
			{
				title: "1. Send the request without paying",
				paragraphs: [
					"Call x402_request with the URL, HTTP method, and any body or headers required by the service. It returns either the service response or a payment quote with a quoteId, price in satoshis, and expiry. It never automatically pays.",
					"This sends a real request. If the service allows it without payment, the operation can execute immediately. Use the method intended for the task: GET for a lookup, for example, or POST to create something.",
					"For a service using BSV mutual authentication, set auth to brc31. The wallet proves its identity and derives payment details, but does not sign a payment until you authorize it. These services use BRC-31 authentication and BRC-105 payments.",
				],
				code: '{\n  "url": "https://service.example/generate",\n  "method": "POST",\n  "headers": {\n    "content-type": "application/json"\n  },\n  "body": "{\\"prompt\\":\\"an image of a cat\\"}",\n  "auth": "brc31"\n}',
			},
			{
				title: "2. Review and pay the quote",
				paragraphs: [
					"Review the service URL, requested operation, price, and any terms returned by the service. Once you approve, call x402_payQuote with the quoteId and maxTotalSats: the most you will spend, including the mining fee.",
					"The client uses the stored request so the URL, method, body, and credentials cannot be changed by the payment call. The connected BRC-100 wallet funds and signs the transaction under its permissions. The client checks the price and fee before submitting the payment proof.",
					"The result includes the payment transaction ID and the service response. A successful HTTP response does not independently prove blockchain confirmation. DISABLE_BROADCASTING blocks payments; DISABLE_WALLET_TOOLS prevents the client from using the wallet.",
				],
			},
			{
				title: "Example: upgrade BananaBlocks",
				paragraphs: [
					"BananaBlocks sells higher API rate limits through a paid POST request. Its API key identifies the account being upgraded; it is a BananaBlocks requirement, not an x402 requirement. Configure that credential as shown below, then send this request and review the returned price.",
					"After payment, use x402_request with GET https://bananablocks.com/api/v1/key/usage to check the tier. If you also use bsv_explore, set EXPLORER_API_KEY to the same key so explorer calls use the purchased allowance.",
				],
				code: '{\n  "url": "https://bananablocks.com/api/v1/key/upgrade",\n  "method": "POST",\n  "headers": {\n    "content-type": "application/json"\n  },\n  "body": "{\\"tier\\":\\"pro\\"}"\n}',
			},
			{
				title: "Optional credentials for a service",
				paragraphs: [
					"If a service needs an API key or bearer token, set X402_SERVICE_HEADERS in the MCP server environment. It maps exact HTTPS origins to their required headers. A credential for one origin is never sent to another origin. Keep secrets out of tool arguments, chat, and source control.",
					"The example below is only needed for BananaBlocks. A service that accepts payment without an account needs no credential configuration.",
				],
				code: 'X402_SERVICE_HEADERS=\'{"https://bananablocks.com":{"X-API-Key":"YOUR_KEY"}}\'',
			},
			{
				title: "Supported payment formats",
				paragraphs: [
					"The client supports BRC-105 x-bsv-payment requests, request-bound BRC-120 challenges with OP_TRUE server nonces, and compact bsv-tx-v1 challenges such as those used by BananaBlocks. It selects the proof format from the service response; an unsupported format is rejected before payment.",
					"An OP_TRUE nonce is a small server-provided transaction output that anyone can spend. Including it ties a BRC-120 payment to one challenge. Other nonce scripts need an additional unlocking implementation. The client obtains nonce transaction proofs through the configured 1Sat service.",
					"For BRC-120, the URL, method, body, and selected headers must match the challenge. If the service binds only some headers, provide their names in boundHeaders according to that service’s documentation. By default, the client checks all supplied request headers.",
					"Requests must use public HTTPS addresses. Redirects are refused. Request and response bodies are limited to 1 MiB; use bodyEncoding: base64 to send binary content. Binary responses include their encoding. The x402 Foundation’s EVM and Solana payment formats are not supported by this BSV wallet client.",
				],
			},
			{
				title: "If payment does not complete",
				paragraphs: [
					"Do not pay again after a timeout or an unexpected response. Check wallet_listActions and the service first: it may have accepted the payment even if its reply was lost. The client does not create a second payment automatically.",
					"A not_submitted result means the transaction was withheld; wallet funds may still be reserved. An outcome_unknown result requires checking whether the service received it before releasing inputs or trying again. Further payments are blocked in that MCP session after such a failure.",
					"Quotes are kept for the current MCP session, and wallet history records attempted challenge IDs. Restarting the server does not establish that an earlier payment failed. Refund handling is not yet automated.",
				],
			},
		],
		links: [
			{
				label: "BananaBlocks API",
				href: "https://bananablocks.com/api/docs",
			},
		],
	},
	{
		id: "sponsorship",
		title: "Use a sponsor",
		paragraphs: [
			"A Droplit sponsor can provide funding or pay for supported operations, subject to its approval and quotas. Being listed in the sponsor catalog does not guarantee funding.",
		],
		topics: [
			{
				title: "Find a sponsor",
				paragraphs: [
					"Set DROPLIT_API_URL to the sponsor API, including its base path. Call droplit_discover to list sponsors; this public lookup requires no wallet or selected sponsor. An empty list is a valid response.",
				],
				code: "DROPLIT_API_URL=https://api.droplit.dev/droplit\nDROPLIT_FAUCET_NAME=your-sponsor-slug\n# Optional if the approval UI is hosted elsewhere\nDROPLIT_SITE_URL=https://droplit.dev",
			},
			{
				title: "Check access before requesting funds",
				paragraphs: [
					"Set DROPLIT_FAUCET_NAME to a sponsor slug (its short identifier) returned by the catalog, then call droplit_getAccess to check authorization and quotas. If approval is required, follow the returned link for the owner to review your request. Wallet identity and Sigma delegation do not grant sponsor approval. Creating your own faucet requires funding.",
					"Leave USE_DROPLIT_API unset when pairing sponsorship with an existing wallet or locally managed BRC-100 wallet. The older USE_DROPLIT_API=true wallet mode is separate. DROPLIT_SITE_URL defaults to https://droplit.dev and must be an HTTPS origin, or HTTP loopback, without a path, query, fragment or credentials.",
				],
			},
			{
				title: "Submit a sponsored operation",
				paragraphs: [
					"droplit_push publishes data and droplit_fund requests funding and broadcast. They honor broadcast-disable settings and do not automatically pay 402 responses, follow redirects or retry ambiguous writes. For an authorized user, an omitted quota category has no limit; a category set to zero allows no operations. Permission to transfer funds or perform a certain number of operations does not guarantee enough funding for transaction fees. If the outcome is unknown, check whether the operation succeeded before submitting it again.",
				],
			},
		],
	},
	{
		id: "delegation",
		title: "Use an existing delegation",
		paragraphs: [
			"A delegation is permission for an agent to act on someone else's behalf, with limits set by that person. In Sigma, the owner gives the agent a digital certificate recording those permissions.",
			"To use it here, you need the setup data supplied by the owner, called a handoff, and the agent wallet named in the certificate. Connect that same wallet so it can prove the permission belongs to this agent. The certificate follows BRC-169.",
		],
		topics: [
			{
				title: "Submit the owner handoff",
				paragraphs: [
					"Once the owner has issued the certificate, call wallet_revealDelegation. Put the complete handoff JSON in handoffJSON and the address of the Sigma service that will verify it in sigmaOrigin. Keep all four handoff fields: certificate, subjectKeyring, revealTo, and revelationPath.",
					"The tool acquires the certificate, proves its restrictions and sends only the verifier keyring to the specified Sigma verifier. The subject keyring stays with the wallet. It activates an existing delegation; it does not issue one, pay, broadcast or grant sponsor approval. An Ed25519 agent token cannot replace the bound wallet for this step.",
				],
			},
			{
				title: "Handle an uncertain result",
				paragraphs: [
					"The Sigma origin must be HTTPS (HTTP loopback is allowed for local testing). Redirects and ambiguous POST retries are disabled. If the result is outcome_unknown, refresh the delegation status before trying again; certificate acquisition may already have succeeded.",
				],
			},
		],
	},
	{
		id: "troubleshooting",
		title: "Troubleshooting",
		paragraphs: [],
		topics: [
			{
				title: "The 1Sat service is unavailable",
				paragraphs: [
					"Start with bsv_status. A capabilities error identifies the configured 1Sat service; check the base URL and enabled modules. A 404 from a self-hosted market or ORDFS route may mean that module is disabled. Do not append /1sat twice.",
				],
			},
			{
				title: "The wallet cannot connect",
				paragraphs: [
					"Check that BRC100_WALLET_URL points to the wallet signing API, not its storage endpoint. Confirm that BRC100_WALLET_ORIGINATOR identifies this app, that BSV_CHAIN matches the wallet network, and that any request shown in the wallet has been approved. If a transaction request timed out, check wallet history before retrying; it may already have succeeded.",
				],
			},
			{
				title: "A payment is missing",
				paragraphs: [
					"Ask the assistant to run wallet_refreshUtxos, then check the balance again. If it is still missing, inspect the transaction with bsv_explore. Indexing and wallet import must finish before a received payment appears in the wallet balance.",
				],
			},
		],
	},
	{
		id: "development",
		title: "Development",
		paragraphs: [
			"This project is experimental. For development, use Bun and the commands below. The tool catalog is a snapshot of one server configuration, not a guarantee that every installation exposes the same tools. The manifest command registers tools with a synthetic test wallet in memory. It does not initialize a funded wallet or read local keys.",
		],
		code: "bun install\nbun run dev          # Website\nbun run build:all    # MCP server + dashboard\nbun run build:next   # Production website\nbun test             # Includes server-start integration checks\nbun run lint",
		links: [
			{
				label: "Report an issue",
				href: "https://github.com/b-open-io/bsv-mcp/issues",
			},
			{
				label: "Source",
				href: "https://github.com/b-open-io/bsv-mcp",
			},
		],
	},
];

function topicMarkdown(topic: DocTopic, level: number): string {
	return [
		`${"#".repeat(level)} ${topic.title}`,
		...topic.paragraphs.map(linkBrcMarkdown),
		...(topic.code ? [`\`\`\`\n${topic.code}\n\`\`\``] : []),
	].join("\n\n");
}

export function renderDocsMarkdown(): string {
	return `# BSV MCP documentation\n\n${docs
		.map((section) =>
			[
				topicMarkdown(section, 2),
				...(section.topics ?? []).map((topic) => topicMarkdown(topic, 3)),
				...(section.links ?? []).map(
					(link) =>
						`[${link.label}](${link.href.startsWith("/") ? SITE_URL + link.href : link.href})`,
				),
			].join("\n\n"),
		)
		.join("\n\n")}`;
}
