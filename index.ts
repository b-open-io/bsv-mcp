#!/usr/bin/env bun

// Redirect console.log/warn/info/debug to stderr in stdio mode.
// MCP stdio transport uses stdout exclusively for JSON-RPC messages —
// any stray stdout output corrupts the protocol. Must run before any import.
const _isStdio =
	process.argv.includes("--stdio") ||
	process.env.TRANSPORT?.toLowerCase() === "stdio";
if (_isStdio) {
	const _err = console.error.bind(console);
	console.log = (...a: unknown[]) => _err("[log]", ...a);
	console.warn = (...a: unknown[]) => _err("[warn]", ...a);
	console.info = (...a: unknown[]) => _err("[info]", ...a);
	console.debug = (...a: unknown[]) => _err("[debug]", ...a);
}

import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrivateKey } from "@bsv/sdk";
import {
	RESOURCE_MIME_TYPE,
	registerAppResource,
	registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import packageJson from "./package.json";
import { registerAllPrompts } from "./prompts/index.ts";
import { registerResources } from "./resources/resources.ts";
import { getBsvPriceWithCache } from "./tools/bsv/getPrice.ts";
import { registerAllTools, type ToolsConfig } from "./tools/index.ts";
import { IntegratedWallet } from "./tools/wallet/integratedWallet.ts";
import { Wallet } from "./tools/wallet/wallet.ts";
import { BunSSEServerTransport } from "./transports/sse.ts";
import {
	type BSVJWTPayload,
	createMCPJWTValidator,
	generateWWWAuthenticate,
} from "./utils/jwtValidator.ts";
import { SecureKeyManager } from "./utils/keyManager.ts";
import { setServerInstance } from "./utils/passphrasePrompt.ts";

// Initialize server variable
let server: McpServer | undefined;

/**
 * Configuration options from environment variables
 */
const CONFIG = {
	// Whether to load various components
	loadPrompts: process.env.DISABLE_PROMPTS !== "true",
	loadResources: process.env.DISABLE_RESOURCES !== "true",
	loadTools: process.env.DISABLE_TOOLS !== "true",

	// Fine-grained tool category control (dependent on key availability)
	loadWalletTools: process.env.DISABLE_WALLET_TOOLS !== "true",
	loadMneeTools: process.env.DISABLE_MNEE_TOOLS !== "true",
	loadBsvTools: process.env.DISABLE_BSV_TOOLS !== "true",
	loadOrdinalsTools: process.env.DISABLE_ORDINALS_TOOLS !== "true",
	loadUtilsTools: process.env.DISABLE_UTILS_TOOLS !== "true",
	loadA2bTools: process.env.ENABLE_A2B_TOOLS === "true",
	loadBapTools: process.env.DISABLE_BAP_TOOLS !== "true",
	loadBsocialTools: process.env.DISABLE_BSOCIAL_TOOLS !== "true",
	// Transaction broadcasting control
	disableBroadcasting: process.env.DISABLE_BROADCASTING === "true",

	// --- Transport Mode ---
	// --stdio CLI flag takes precedence over TRANSPORT env var (matches neighborhood plugin pattern)
	transportMode: process.argv.includes("--stdio")
		? "stdio"
		: (process.env.TRANSPORT?.toLowerCase() || "http"), // 'stdio' or 'http'/default
	port: Number.parseInt(process.env.PORT || "3000", 10),

	// --- Droplet API Configuration ---
	useDropletApi: process.env.USE_DROPLET_API === "true",
	dropletApiUrl: process.env.DROPLET_API_URL || "http://127.0.0.1:4000",
	dropletFaucetName: process.env.DROPLET_FAUCET_NAME || "",

	// --- OAuth Configuration ---
	enableOAuth: process.env.ENABLE_OAUTH !== "false", // Enabled by default
	oauthIssuer: process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com",
	resourceUrl: process.env.RESOURCE_URL || "", // Will be set based on port
};

const logFunc = console.error;
const KEY_DIR = path.join(os.homedir(), ".bsv-mcp");
const KEY_FILE_PATH = path.join(KEY_DIR, "keys.json");

/**
 * Initializes payment and identity private keys using SecureKeyManager.
 * Priorities:
 * 1. Valid PRIVATE_KEY_WIF environment variable (provides payPk, identityPk remains undefined).
 * 2. Valid keys found in encrypted ~/.bsv-mcp/keys.bep or legacy ~/.bsv-mcp/keys.json file.
 * 3. Generate only payPk, save it to the file, and log warnings. identityPk/xprv only created via bap_generate.
 * Returns the keys and their source ('env', 'file', 'encrypted', 'generated', or 'none').
 */
async function initializeKeys(): Promise<{
	payPk?: PrivateKey;
	identityPk?: PrivateKey;
	xprv?: string;
	source: "env" | "file" | "encrypted" | "generated" | "none";
}> {
	const keyManager = new SecureKeyManager({ keyDir: KEY_DIR });

	const privateKeyWifEnv = process.env.PRIVATE_KEY_WIF;

	// 1. Try environment variable for payPk
	if (privateKeyWifEnv) {
		try {
			const payPk = PrivateKey.fromWif(privateKeyWifEnv);
			console.error(
				"\x1b[32mINFO: Using valid PRIVATE_KEY_WIF from environment for payment key.\x1b[0m",
			);

			// Also check for encrypted/legacy keys to get xprv if available
			let xprvFromFile: string | undefined;
			try {
				const { keys } = await keyManager.loadKeys();
				xprvFromFile = keys.xprv;
				if (xprvFromFile) {
					console.error(
						"\x1b[32mINFO: Loaded BAP HD Master Key (xprv) from secure storage alongside ENV payPk.\x1b[0m",
					);
				}
			} catch (_e) {
				/* Ignore file read errors here */
			}

			if (!xprvFromFile) {
				console.error(
					"\x1b[33mWARN: No identity key (identityPk or xprv) found. BAP/A2B tools needing identity will be limited.\x1b[0m",
				);
			}

			return {
				payPk,
				identityPk: undefined,
				xprv: xprvFromFile,
				source: "env",
			};
		} catch (_error) {
			console.error(
				"\x1b[33mWARN: Invalid PRIVATE_KEY_WIF format in environment variable. Checking secure storage next.\x1b[0m",
			);
		}
	}

	// 2. Try reading from secure storage (encrypted or legacy)
	try {
		const { keys, source } = await keyManager.loadKeys();

		if (keys.payPk) {
			if (source === "encrypted") {
				console.error(
					`\x1b[32mINFO: Using encrypted keys from: ${KEY_DIR}/keys.bep\x1b[0m`,
				);
			} else if (source === "legacy") {
				console.error(
					`\x1b[32mINFO: Using legacy keys from: ${KEY_FILE_PATH}\x1b[0m`,
				);
				console.error(
					"\x1b[33mWARN: Using unencrypted keys. Run the server again to encrypt them.\x1b[0m",
				);
			}

			if (keys.identityPk) {
				console.error(
					"\x1b[32mINFO: Loaded Identity Key (identityPk) from secure storage.\x1b[0m",
				);
			}
			if (keys.xprv) {
				console.error(
					"\x1b[32mINFO: Loaded BAP HD Master Key (xprv) from secure storage.\x1b[0m",
				);
			}

			return {
				payPk: keys.payPk,
				identityPk: keys.identityPk,
				xprv: keys.xprv,
				source: source === "encrypted" ? "encrypted" : "file",
			};
		}

		console.error("\x1b[33mINFO: No keys found in secure storage.\x1b[0m");
	} catch (error) {
		console.error(
			`\x1b[33mWARN: Error reading keys from secure storage: ${error}\x1b[0m`,
		);
	}

	// 3. Generate new payment key (but not identityPk/xprv)
	console.error("\x1b[33mINFO: Generating new payment key ONLY.\x1b[0m");
	const payPk = PrivateKey.fromRandom();
	const keyStore = {
		payPk,
		identityPk: undefined,
		xprv: undefined,
	};

	try {
		// Save unencrypted for now - user can encrypt on next run
		await keyManager.saveKeys(keyStore, { forceUnencrypted: true });
		const status = keyManager.getStatus();

		if (status.hasEncrypted) {
			console.error(
				`\x1b[33mWARN: Saved newly generated payment key (encrypted) to: ${KEY_DIR}/keys.bep\x1b[0m`,
			);
		} else {
			console.error(
				`\x1b[33mWARN: Saved newly generated payment key (unencrypted) to: ${KEY_FILE_PATH}\x1b[0m`,
			);
			console.error(
				"\x1b[33mWARN: Run the server again to encrypt your keys.\x1b[0m",
			);
		}
		console.error(
			"\x1b[33mWARN: Identity key (identityPk/xprv) not found or generated. Use 'bap_generate' tool to create one.\x1b[0m",
		);
	} catch (writeError) {
		console.error(
			`\x1b[31mERROR: Failed to save newly generated payment key: ${writeError}\x1b[0m`,
		);
		console.error(
			"\x1b[31mERROR: Using the generated payment key for this session only. No identity key available.\x1b[0m",
		);
	}

	return { payPk, identityPk: undefined, xprv: undefined, source: "generated" };
}

// --- MCP App Tools & Resource ---
const APP_RESOURCE_URI = "ui://bsv-mcp/app.html";
const __appDirname = dirname(fileURLToPath(import.meta.url));

function registerMcpAppTools(server: McpServer, wallet?: Wallet) {
	// Primary dashboard tool — model calls this to open the UI
	registerAppTool(
		server,
		"bsv_dashboard",
		{
			title: "BSV Dashboard",
			description:
				"Interactive BSV dashboard with Explorer, Wallet, and Ordinals tabs. Use this for any BSV-related query that benefits from visual display.",
			inputSchema: {},
			_meta: {
				ui: { resourceUri: APP_RESOURCE_URI },
			},
		},
		async () => {
			return {
				content: [{ type: "text" as const, text: "BSV Dashboard opened" }],
				structuredContent: { view: "dashboard", ready: true },
				_meta: { viewUUID: crypto.randomUUID() },
			};
		},
	);

	// App-only: fetch explorer data (price, chain info, tx decode, address lookup)
	registerAppTool(
		server,
		"app_explorer_data",
		{
			title: "Explorer Data",
			description:
				"App-only: fetches BSV price, chain info, decodes transactions, and looks up addresses.",
			inputSchema: {
				txid: z.string().optional().describe("Transaction ID to decode"),
				address: z
					.string()
					.optional()
					.describe("Address to look up balance/history"),
			},
			_meta: {
				ui: { resourceUri: APP_RESOURCE_URI, visibility: ["app"] },
			},
		},
		async (args) => {
			const { txid, address } = args as {
				txid?: string;
				address?: string;
			};

			// If txid provided, decode transaction
			if (txid) {
				try {
					const res = await fetch(
						`https://junglebus.gorillapool.io/v1/transaction/get/${txid}`,
					);
					if (!res.ok)
						throw new Error(`Transaction not found: ${res.status}`);
					const jbData = (await res.json()) as Record<string, unknown>;

					const { Transaction, Utils } = await import("@bsv/sdk");
					const rawTx = jbData.transaction as string;
					const isBase64 = /^[A-Za-z0-9+/=]+$/.test(rawTx);
					const txBytes = isBase64
						? Utils.toArray(rawTx, "base64")
						: Utils.toArray(rawTx, "hex");
					const tx = Transaction.fromBinary(txBytes);

					return {
						content: [
							{ type: "text" as const, text: `Decoded transaction ${txid}` },
						],
						structuredContent: {
							transaction: {
								txid,
								version: tx.version,
								lockTime: tx.lockTime,
								size: tx.toBinary().length,
								inputs: tx.inputs.map((inp) => ({
									txid: inp.sourceTXID,
									vout: inp.sourceOutputIndex,
									script: inp.unlockingScript?.toHex() || "",
								})),
								outputs: tx.outputs.map((out, i) => ({
									n: i,
									value: out.satoshis,
									scriptPubKey: {
										hex: out.lockingScript.toHex(),
										asm: out.lockingScript.toASM(),
									},
								})),
								confirmations: jbData.block_height ? 1 : 0,
								block: jbData.block_hash
									? {
											hash: jbData.block_hash,
											height: jbData.block_height,
										}
									: null,
							},
						},
						_meta: { viewUUID: crypto.randomUUID() },
					};
				} catch (err) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Error: ${err instanceof Error ? err.message : String(err)}`,
							},
						],
						structuredContent: { error: String(err) },
						_meta: { viewUUID: crypto.randomUUID() },
					};
				}
			}

			// If address provided, look up balance and history
			if (address) {
				try {
					const [balRes, histRes] = await Promise.all([
						fetch(
							`https://api.whatsonchain.com/v1/bsv/main/address/${address}/balance`,
						),
						fetch(
							`https://api.whatsonchain.com/v1/bsv/main/address/${address}/history`,
						),
					]);
					const balance = balRes.ok
						? ((await balRes.json()) as Record<string, unknown>)
						: null;
					const history = histRes.ok
						? ((await histRes.json()) as Array<Record<string, unknown>>)
						: [];

					return {
						content: [
							{ type: "text" as const, text: `Address info for ${address}` },
						],
						structuredContent: {
							addressInfo: { balance, history },
						},
						_meta: { viewUUID: crypto.randomUUID() },
					};
				} catch (err) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Error: ${err instanceof Error ? err.message : String(err)}`,
							},
						],
						structuredContent: { error: String(err) },
						_meta: { viewUUID: crypto.randomUUID() },
					};
				}
			}

			// Default: return price + chain info
			try {
				const [price, chainRes] = await Promise.all([
					getBsvPriceWithCache(),
					fetch("https://api.whatsonchain.com/v1/bsv/main/chain/info"),
				]);
				const chainInfo = chainRes.ok
					? ((await chainRes.json()) as Record<string, unknown>)
					: null;

				return {
					content: [
						{
							type: "text" as const,
							text: `BSV price: $${price.toFixed(2)}`,
						},
					],
					structuredContent: { price, chainInfo },
					_meta: { viewUUID: crypto.randomUUID() },
				};
			} catch (err) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
					structuredContent: { error: String(err) },
					_meta: { viewUUID: crypto.randomUUID() },
				};
			}
		},
	);

	// App-only: fetch wallet data
	registerAppTool(
		server,
		"app_wallet_data",
		{
			title: "Wallet Data",
			description: "App-only: fetches wallet balance, UTXOs, and address.",
			inputSchema: {},
			_meta: {
				ui: { resourceUri: APP_RESOURCE_URI, visibility: ["app"] },
			},
		},
		async () => {
			if (!wallet) {
				return {
					content: [
						{
							type: "text" as const,
							text: "No wallet configured",
						},
					],
					structuredContent: {
						error: "No wallet configured. Set PRIVATE_KEY_WIF or generate keys.",
					},
					_meta: { viewUUID: crypto.randomUUID() },
				};
			}

			try {
				const { paymentUtxos } = await wallet.getUtxos();
				const address = wallet.getAddress();
				let totalSatoshis = 0;
				for (const utxo of paymentUtxos) {
					totalSatoshis += utxo.satoshis || 0;
				}

				let price: number | undefined;
				try {
					price = await getBsvPriceWithCache();
				} catch {
					/* price fetch optional */
				}

				const { toBitcoin } = await import("satoshi-token");
				const bsvAmount = toBitcoin(totalSatoshis);

				return {
					content: [
						{
							type: "text" as const,
							text: `Wallet balance: ${bsvAmount} BSV`,
						},
					],
					structuredContent: {
						balance: {
							satoshis: totalSatoshis,
							bsv: bsvAmount,
							utxoCount: paymentUtxos.length,
						},
						address,
						utxos: paymentUtxos.slice(0, 50).map((u) => ({
							txid: u.txid,
							vout: u.vout,
							satoshis: u.satoshis,
						})),
						price,
					},
					_meta: { viewUUID: crypto.randomUUID() },
				};
			} catch (err) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
					structuredContent: { error: String(err) },
					_meta: { viewUUID: crypto.randomUUID() },
				};
			}
		},
	);

	// App-only: fetch ordinals data
	registerAppTool(
		server,
		"app_ordinals_data",
		{
			title: "Ordinals Data",
			description:
				"App-only: fetches ordinals/NFT marketplace listings and search results.",
			inputSchema: {
				query: z.string().optional().describe("Search query"),
			},
			_meta: {
				ui: { resourceUri: APP_RESOURCE_URI, visibility: ["app"] },
			},
		},
		async (args) => {
			const { query } = args as { query?: string };

			try {
				if (query) {
					// Search inscriptions
					const url = new URL(
						"https://ordinals.gorillapool.io/api/inscriptions/search",
					);
					url.searchParams.set("limit", "20");
					url.searchParams.set("offset", "0");
					url.searchParams.set("dir", "desc");
					url.searchParams.set("terms", query);

					const res = await fetch(url.toString());
					if (!res.ok) throw new Error(`Search failed: ${res.status}`);
					const data = (await res.json()) as Record<string, unknown>;

					return {
						content: [
							{
								type: "text" as const,
								text: `Found results for "${query}"`,
							},
						],
						structuredContent: {
							results: data.results || [],
							total: data.total || 0,
						},
						_meta: { viewUUID: crypto.randomUUID() },
					};
				}

				// Default: fetch marketplace listings
				const res = await fetch(
					"https://ordinals.gorillapool.io/api/market?limit=20&offset=0&sort=recent&dir=desc",
				);
				if (!res.ok) throw new Error(`Market fetch failed: ${res.status}`);
				const data = (await res.json()) as Record<string, unknown>;

				return {
					content: [
						{ type: "text" as const, text: "Marketplace listings loaded" },
					],
					structuredContent: {
						listings: data.results || [],
						total: data.total || 0,
					},
					_meta: { viewUUID: crypto.randomUUID() },
				};
			} catch (err) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
					structuredContent: { error: String(err) },
					_meta: { viewUUID: crypto.randomUUID() },
				};
			}
		},
	);

	// Register the HTML resource
	registerAppResource(
		server,
		"BSV Dashboard",
		APP_RESOURCE_URI,
		{ description: "Interactive BSV dashboard with Explorer, Wallet, and Ordinals tabs" },
		async () => {
			const distPath = join(__appDirname, "dist", "app.html");
			let html: string;
			try {
				html = await readFile(distPath, "utf-8");
			} catch {
				html = "<html><body><p>Dashboard not built. Run <code>bun run build:view</code> to enable it.</p></body></html>";
			}
			return {
				contents: [
					{
						uri: APP_RESOURCE_URI,
						mimeType: RESOURCE_MIME_TYPE,
						text: html,
					},
				],
			};
		},
	);
}

// --- Main Server Setup ---
async function main() {
	// Check for help or info commands that don't need authentication
	const args = process.argv.slice(2);
	if (args.includes("--help") || args.includes("-h") || args.includes("help")) {
		console.log(`
BSV MCP Server v${packageJson.version}

Usage: bun run index.ts [options]

Options:
  --help, -h          Show this help message
  --version, -v       Show version information

Environment Variables:
  TRANSPORT           Transport mode: 'stdio' or 'http' (default: http)
  PORT               HTTP server port (default: 3000)
  PRIVATE_KEY_WIF    Payment private key in WIF format
  DISABLE_TOOLS      Disable all tools (default: false)
  DISABLE_WALLET_TOOLS   Disable wallet tools (default: false)
  DISABLE_BSV_TOOLS      Disable BSV tools (default: false)
  DISABLE_ORDINALS_TOOLS Disable ordinals tools (default: false)
  DISABLE_UTILS_TOOLS    Disable utility tools (default: false)
  DISABLE_BAP_TOOLS      Disable BAP tools (default: false)  
  DISABLE_BSOCIAL_TOOLS  Disable BSocial tools (default: false)
  ENABLE_A2B_TOOLS       Enable A2B tools (default: false)
  DISABLE_BROADCASTING   Disable transaction broadcasting (default: false)
  USE_DROPLET_API        Use Droplet API for transactions (default: false)

Tool Categories:
  BSV Tools:      Price lookup, transaction decoding, validation
  Wallet Tools:   Send payments, manage UTXOs (requires payment key)
  Ordinals Tools: Search listings, market data
  Utils Tools:    General utilities, conversions
  BAP Tools:      Identity management (requires identity key)
  BSocial Tools:  Social posts, likes, follows
  A2B Tools:      Advanced BSV operations (requires identity key)

Authentication:
  - Most tools work without authentication
  - Wallet operations require PRIVATE_KEY_WIF or generated keys
  - BAP/A2B tools require identity keys (generated via bap_generate tool)
		`);
		process.exit(0);
	}

	if (args.includes("--version") || args.includes("-v")) {
		console.log(`${packageJson.name} v${packageJson.version}`);
		process.exit(0);
	}

	// --- Initialize Keys ---
	const { payPk, identityPk, xprv, source: keySource } = await initializeKeys();

	// Define persistence based on source
	const hasPersistentPayKey =
		keySource === "env" || keySource === "file" || keySource === "encrypted";
	const hasPersistentIdentityKey =
		!!identityPk && (keySource === "file" || keySource === "encrypted");
	const hasXprv =
		!!xprv &&
		(keySource === "file" || keySource === "env" || keySource === "encrypted");

	const effectiveConfig = { ...CONFIG };

	// --- Configuration Logging ---
	logFunc("\n--- BSV MCP Server Configuration ---");
	logFunc(`Server Version: ${packageJson.version}`);
	logFunc(`Server Name: ${packageJson.name}`);
	logFunc("\nEnvironment Variables:");
	logFunc(
		`  TRANSPORT:            ${process.env.TRANSPORT || "Not Set (http default)"}`,
	);
	if (CONFIG.transportMode === "http") {
		logFunc(
			`  PORT:                 ${process.env.PORT || "Not Set (3000 default)"}`,
		);
	}
	logFunc(
		`  PRIVATE_KEY_WIF:      ${process.env.PRIVATE_KEY_WIF ? "Set (using env key)" : "Not Set (using file/generating)"}`,
	);
	logFunc(
		`  IDENTITY_KEY_WIF:     ${process.env.IDENTITY_KEY_WIF ? "Set (using env key)" : "Not Set (using file/generating)"}`,
	);
	if (process.env.BSV_MCP_PASSPHRASE) {
		logFunc("  BSV_MCP_PASSPHRASE:   \x1b[31mDEPRECATED - Remove this!\x1b[0m");
	}
	logFunc(
		`  DISABLE_PROMPTS:      ${process.env.DISABLE_PROMPTS === "true" ? "Set (true)" : "Not Set/false"}`,
	);
	logFunc(
		`  DISABLE_RESOURCES:    ${process.env.DISABLE_RESOURCES === "true" ? "Set (true)" : "Not Set/false"}`,
	);
	logFunc(
		`  DISABLE_TOOLS:        ${process.env.DISABLE_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`,
	);
	logFunc(
		`  DISABLE_WALLET_TOOLS: ${process.env.DISABLE_WALLET_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`,
	);
	logFunc(
		`  DISABLE_MNEE_TOOLS:   ${process.env.DISABLE_MNEE_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`,
	);
	logFunc(
		`  DISABLE_BSV_TOOLS:    ${process.env.DISABLE_BSV_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`,
	);
	logFunc(
		`  DISABLE_ORDINALS_TOOLS: ${process.env.DISABLE_ORDINALS_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`,
	);
	logFunc(
		`  DISABLE_UTILS_TOOLS:  ${process.env.DISABLE_UTILS_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`,
	);
	logFunc(
		`  ENABLE_A2B_TOOLS:     ${process.env.ENABLE_A2B_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`,
	);
	logFunc(
		`  DISABLE_BAP_TOOLS:    ${process.env.DISABLE_BAP_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`,
	);
	logFunc(
		`  DISABLE_BROADCASTING: ${process.env.DISABLE_BROADCASTING === "true" ? "Set (true)" : "Not Set/false"}`,
	);
	logFunc(
		`  USE_DROPLET_API:      ${CONFIG.useDropletApi ? "Set (true)" : "Not Set/false"}`,
	);
	if (CONFIG.useDropletApi) {
		logFunc(`  DROPLET_API_URL:      ${CONFIG.dropletApiUrl}`);
		logFunc(`  DROPLET_FAUCET_NAME:  ${CONFIG.dropletFaucetName || "Not Set"}`);
	}

	logFunc("\nKey Source:");
	let payKeySourceInfo = `Payment Key (payPk): ${keySource}`;
	if (keySource === "env") payKeySourceInfo = "Payment Key (payPk): env";
	if (keySource === "file")
		payKeySourceInfo += ` (Loaded from ${KEY_FILE_PATH})`;
	if (keySource === "encrypted")
		payKeySourceInfo += ` (Loaded from ${KEY_DIR}/keys.bep)`;
	if (keySource === "generated") payKeySourceInfo += " (Generated & saved)";

	let identityKeySourceInfo = "Identity Key (identityPk): Not Loaded";
	if (identityPk && (keySource === "file" || keySource === "encrypted")) {
		identityKeySourceInfo = `Identity Key (identityPk): ${keySource} (Loaded from secure storage)`;
	} else if (identityPk) {
		identityKeySourceInfo = `Identity Key (identityPk): ${keySource} (Unexpected Source)`;
	}

	let xprvSourceInfo = "BAP Master Key (xprv): Not found";
	if (hasXprv) {
		xprvSourceInfo = "BAP Master Key (xprv): Loaded from secure storage";
	}

	logFunc(`  ${payKeySourceInfo}`);
	logFunc(`  ${identityKeySourceInfo}`);
	logFunc(`  ${xprvSourceInfo}`);

	logFunc("\nEffective Component Status:");
	logFunc(`  Transport Mode: ${CONFIG.transportMode.toUpperCase()}`);
	logFunc(
		`  Prompts:        ${effectiveConfig.loadPrompts ? "\x1b[32mEnabled\x1b[0m" : "\x1b[31mDisabled\x1b[0m"}`,
	);
	logFunc(
		`  Resources:      ${effectiveConfig.loadResources ? "\x1b[32mEnabled\x1b[0m" : "\x1b[31mDisabled\x1b[0m"}`,
	);
	logFunc(
		`  Tools (Overall):  ${effectiveConfig.loadTools ? "\x1b[32mEnabled\x1b[0m" : "\x1b[31mDisabled\x1b[0m"}`,
	);
	if (effectiveConfig.loadTools) {
		const walletStatus = effectiveConfig.loadWalletTools
			? "\x1b[32mEnabled\x1b[0m"
			: "\x1b[31mDisabled\x1b[0m";
		const mneeStatus = effectiveConfig.loadMneeTools
			? "\x1b[32mEnabled\x1b[0m"
			: "\x1b[31mDisabled\x1b[0m";
		const a2bStatus = effectiveConfig.loadA2bTools
			? "\x1b[32mEnabled\x1b[0m"
			: "\x1b[31mDisabled\x1b[0m";
		const bapStatus = effectiveConfig.loadBapTools
			? "\x1b[32mEnabled\x1b[0m"
			: "\x1b[31mDisabled\x1b[0m";

		let payKeyNote = "";
		if (!hasPersistentPayKey) {
			payKeyNote = " \x1b[33m(Using generated payPk)\x1b[0m";
		}
		let identityKeyNote = "";
		if (!hasPersistentIdentityKey) {
			identityKeyNote = " \x1b[33m(Using generated identityPk)\x1b[0m";
		}

		logFunc(`    Wallet:       ${walletStatus}${payKeyNote}`);
		logFunc(`    MNEE:         ${mneeStatus}${payKeyNote}`);
		logFunc(
			`    BSV:          ${effectiveConfig.loadBsvTools ? "\x1b[32mEnabled\x1b[0m" : "\x1b[31mDisabled\x1b[0m"}`,
		);
		logFunc(
			`    Ordinals:     ${effectiveConfig.loadOrdinalsTools ? "\x1b[32mEnabled\x1b[0m" : "\x1b[31mDisabled\x1b[0m"}`,
		);
		logFunc(
			`    Utils:        ${effectiveConfig.loadUtilsTools ? "\x1b[32mEnabled\x1b[0m" : "\x1b[31mDisabled\x1b[0m"}`,
		);
		logFunc(`    A2B:          ${a2bStatus}${identityKeyNote}`);
		logFunc(`    BAP:          ${bapStatus}${identityKeyNote}`);
		logFunc(
			`    BSocial:      ${effectiveConfig.loadBsocialTools ? "\x1b[32mEnabled\x1b[0m" : "\x1b[31mDisabled\x1b[0m"}`,
		);
		if (effectiveConfig.loadWalletTools) {
			logFunc(
				`      Broadcasting: ${!effectiveConfig.disableBroadcasting ? "\x1b[32mEnabled\x1b[0m" : "\x1b[31mDisabled\x1b[0m"}`,
			);
		}
	}
	logFunc("------------------------------------\n");
	// --- End of Logging Block ---

	server = new McpServer(
		{ name: packageJson.name, version: packageJson.version },
		{
			capabilities: {
				prompts: {},
				resources: {},
				tools: {},
				experimental: {
					"io.modelcontextprotocol/ui": { version: "0.1" },
				},
			},
			instructions: `
				This server exposes Bitcoin SV helpers.
				Tools are idempotent unless marked destructive.
			`,
		},
	);

	// Set server instance for transport detection
	setServerInstance(server);

	let wallet: Wallet | undefined;
	let integratedWallet: IntegratedWallet | undefined;

	if (CONFIG.loadTools) {
		// Check if we should use Droplet API mode
		if (CONFIG.useDropletApi && CONFIG.dropletFaucetName) {
			// Initialize IntegratedWallet in Droplet mode
			if (CONFIG.loadWalletTools) {
				try {
					integratedWallet = new IntegratedWallet({
						useDropletApi: true,
						dropletConfig: {
							apiUrl: CONFIG.dropletApiUrl,
							faucetName: CONFIG.dropletFaucetName,
							// Note: authKey will be set by IntegratedWallet if paymentKey is provided
						},
						paymentKey: payPk, // Pass payment key for auth
						identityKey: identityPk,
					});
					logFunc(
						`\x1b[32mINFO: Droplet API mode initialized successfully (Faucet: ${CONFIG.dropletFaucetName}).\x1b[0m`,
					);
					logFunc(
						`\x1b[33mNOTE: Using Droplet API at ${CONFIG.dropletApiUrl}\x1b[0m`,
					);
					logFunc(
						"\x1b[33mNOTE: Local keys are ignored in Droplet API mode\x1b[0m",
					);
					// Create a compatibility wrapper for existing code
					wallet = integratedWallet.getLocalWallet(); // This will be undefined in Droplet mode

					// In Droplet mode, we need to disable tools that require local keys
					effectiveConfig.loadMneeTools = false; // MNEE requires local wallet
					effectiveConfig.loadBapTools = false; // BAP requires identity key
					effectiveConfig.loadA2bTools = false; // A2B requires identity key
					effectiveConfig.loadBsocialTools = false; // BSocial requires local wallet
				} catch (e) {
					logFunc(
						`\x1b[31mERROR: Failed to initialize Droplet API mode: ${e instanceof Error ? e.message : String(e)}. Wallet-dependent tools will be unavailable.\x1b[0m`,
					);
					integratedWallet = undefined;
					effectiveConfig.loadWalletTools = false;
					effectiveConfig.loadMneeTools = false;
					effectiveConfig.loadBapTools = false;
				}
			}
		} else if (payPk) {
			// Initialize wallet with the payPk if wallet tools are enabled
			if (CONFIG.loadWalletTools) {
				try {
					wallet = new Wallet(payPk, identityPk);
					integratedWallet = new IntegratedWallet({
						paymentKey: payPk,
						identityKey: identityPk,
					});
					logFunc(
						"\x1b[32mINFO: Custom Wallet initialized successfully.\x1b[0m",
					);
					if (!hasPersistentPayKey) {
						logFunc(
							"\x1b[33mWARN: Wallet is using a generated payment key for this session only. It will not persist.\x1b[0m",
						);
					}
					if (identityPk && !hasPersistentIdentityKey && !hasXprv) {
						logFunc(
							"\x1b[33mWARN: Wallet is using an identity key that might not be from a persistent file source (keys.json xprv or identityPk field) for BAP operations.\x1b[0m",
						);
					}
				} catch (e) {
					logFunc(
						`\x1b[31mERROR: Failed to initialize custom wallet: ${e instanceof Error ? e.message : String(e)}. Wallet-dependent tools will be unavailable.\x1b[0m`,
					);
					wallet = undefined;
					integratedWallet = undefined;
					effectiveConfig.loadWalletTools = false;
					effectiveConfig.loadMneeTools = false;
					effectiveConfig.loadBapTools = false;
				}
			}

			// Disable MNEE tools if wallet is not available
			if (effectiveConfig.loadMneeTools && !wallet && CONFIG.loadWalletTools) {
				logFunc(
					"\x1b[33mWARN: MNEE tools require a wallet but wallet initialization failed. MNEE tools disabled.\x1b[0m",
				);
				effectiveConfig.loadMneeTools = false;
			}
		}

		// Register all other tools based on configuration
		const toolsConfig: ToolsConfig = {
			enableBsvTools: effectiveConfig.loadBsvTools,
			enableOrdinalsTools: effectiveConfig.loadOrdinalsTools,
			enableUtilsTools: effectiveConfig.loadUtilsTools,
			enableA2bTools: effectiveConfig.loadA2bTools,
			enableBapTools: effectiveConfig.loadBapTools,
			enableBsocialTools: effectiveConfig.loadBsocialTools,
			enableWalletTools: effectiveConfig.loadWalletTools,
			enableMneeTools: effectiveConfig.loadMneeTools,
			identityPk,
			payPk,
			xprv,
			wallet,
			integratedWallet,
			disableBroadcasting: effectiveConfig.disableBroadcasting,
		};

		registerAllTools(server, toolsConfig);
	}

	// Register MCP App tools and resource (interactive UI)
	registerMcpAppTools(server, wallet);

	// Register prompts if enabled
	if (CONFIG.loadPrompts) {
		registerAllPrompts(server);
	}

	// Register resources if enabled
	if (CONFIG.loadResources) {
		registerResources(server);
	}

	// Start the server based on transport mode
	if (CONFIG.transportMode === "stdio") {
		const transport = new StdioServerTransport();
		await server.connect(transport);
		logFunc("BSV MCP Server running on stdio");
	} else {
		const port = CONFIG.port;
		const messageEndpoint = "/messages";
		const activeTransports = new Map<string, BunSSEServerTransport>();

		// Set up resource URL for OAuth
		const resourceUrl = CONFIG.resourceUrl || `http://localhost:${port}`;

		// Initialize JWT validator if OAuth is enabled
		const jwtValidator = CONFIG.enableOAuth
			? createMCPJWTValidator(resourceUrl)
			: null;

		logFunc(`Starting BSV MCP Server in HTTP/SSE mode on port ${port}...`);
		if (CONFIG.enableOAuth) {
			logFunc(`OAuth 2.1 authentication enabled`);
			logFunc(`  Issuer: ${CONFIG.oauthIssuer}`);
			logFunc(`  Resource: ${resourceUrl}`);
		}

		Bun.serve({
			port: port,
			async fetch(req: Request): Promise<Response> {
				const url = new URL(req.url);

				// Skip auth for discovery endpoints
				const isDiscoveryEndpoint =
					url.pathname === "/.well-known/oauth-protected-resource" ||
					url.pathname === "/.well-known/oauth-authorization-server";

				// Validate JWT for protected endpoints (if OAuth enabled)
				let userContext: BSVJWTPayload | null = null;
				if (CONFIG.enableOAuth && jwtValidator && !isDiscoveryEndpoint) {
					try {
						userContext = await jwtValidator.validateFromRequest(req);

						if (!userContext) {
							// No token provided - return 401 with WWW-Authenticate
							return new Response(
								JSON.stringify({
									error: "unauthorized",
									message: "Authentication required",
								}),
								{
									status: 401,
									headers: {
										"Content-Type": "application/json",
										"WWW-Authenticate": generateWWWAuthenticate(
											resourceUrl,
											"invalid_token",
											"Authentication required",
										),
										"Access-Control-Expose-Headers": "WWW-Authenticate",
										"Access-Control-Allow-Origin": "*",
									},
								},
							);
						}

						// Token validated successfully
						logFunc(
							`Authenticated request from user: ${userContext.sub} (pubkey: ${userContext.pubkey?.substring(0, 20)}...)`,
						);
					} catch (error) {
						// Token provided but invalid
						const errorMessage =
							error instanceof Error
								? error.message
								: "Token validation failed";

						logFunc(`JWT validation error: ${errorMessage}`);

						return new Response(
							JSON.stringify({
								error: "invalid_token",
								message: errorMessage,
							}),
							{
								status: 401,
								headers: {
									"Content-Type": "application/json",
									"WWW-Authenticate": generateWWWAuthenticate(
										resourceUrl,
										"invalid_token",
										errorMessage,
									),
									"Access-Control-Expose-Headers": "WWW-Authenticate",
									"Access-Control-Allow-Origin": "*",
								},
							},
						);
					}
				}

				// Handle SSE connection endpoint
				if (req.headers.get("accept") === "text/event-stream") {
					const transport = new BunSSEServerTransport(messageEndpoint);
					activeTransports.set(transport.sessionId, transport);
					logFunc(`New SSE connection: ${transport.sessionId}`);

					try {
						// Connect server instance to THIS transport
						if (!server) throw new Error("Server not initialized");
						await server.connect(transport);
						logFunc(
							`Server connected to transport for session: ${transport.sessionId}`,
						);

						return await transport.createResponse();
					} catch (connectError) {
						logFunc(
							`Error connecting server to transport ${transport.sessionId}: ${connectError}`,
						);
						activeTransports.delete(transport.sessionId); // Clean up if connect fails
						return new Response("Failed to establish SSE connection", {
							status: 500,
						});
					}
				}

				// Handle message POST endpoint
				if (req.method === "POST" && url.pathname === messageEndpoint) {
					const sessionId = url.searchParams.get("sessionId");
					if (!sessionId) {
						return new Response("Missing sessionId query parameter", {
							status: 400,
						});
					}
					const transport = activeTransports.get(sessionId);
					if (!transport) {
						return new Response(`Invalid or expired sessionId: ${sessionId}`, {
							status: 404,
						});
					}
					// Let the specific transport instance handle the message
					return await transport.handlePostMessage(req);
				}

				// Handle OAuth 2.1 Authorization Server Metadata (MCP spec requirement)
				// MCP clients will request this to discover sigma-auth endpoints
				if (
					req.method === "GET" &&
					url.pathname === "/.well-known/oauth-authorization-server"
				) {
					const authServer =
						process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com";

					return new Response(
						JSON.stringify(
							{
								issuer: authServer,
								authorization_endpoint: `${authServer}/api/oauth/authorize`,
								token_endpoint: `${authServer}/api/oauth/token`,
								userinfo_endpoint: `${authServer}/api/oauth/userinfo`,
								jwks_uri: `${authServer}/.well-known/jwks.json`,
								registration_endpoint: `${authServer}/api/oauth/register`,
								scopes_supported: [
									"openid",
									"profile",
									"email",
									"offline_access",
									"bsv:tools",
									"bsv:wallet",
									"bsv:ordinals",
									"bsv:tokens",
								],
								response_types_supported: ["code"],
								grant_types_supported: ["authorization_code", "refresh_token"],
								token_endpoint_auth_methods_supported: ["none"],
								code_challenge_methods_supported: ["S256"],
							},
							null,
							2,
						),
						{
							status: 200,
							headers: {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
								"Cache-Control": "public, max-age=3600",
							},
						},
					);
				}

				// Handle OAuth 2.1 Protected Resource Metadata (RFC 9728)
				if (
					req.method === "GET" &&
					url.pathname === "/.well-known/oauth-protected-resource"
				) {
					const resourceUrl =
						process.env.RESOURCE_URL || `http://localhost:${port}`;
					const authServer =
						process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com";

					return new Response(
						JSON.stringify(
							{
								resource: resourceUrl,
								authorization_servers: [authServer],
								scopes_supported: [
									"openid",
									"profile",
									"email",
									"bsv:tools",
									"bsv:wallet",
									"bsv:ordinals",
									"bsv:tokens",
								],
								bearer_methods_supported: ["header"],
								resource_signing_alg_values_supported: ["RS256", "ES256"],
							},
							null,
							2,
						),
						{
							status: 200,
							headers: {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
								"Access-Control-Allow-Methods": "GET",
								"Access-Control-Allow-Headers": "Content-Type, Authorization",
								"Access-Control-Expose-Headers": "WWW-Authenticate",
								"Cache-Control": "public, max-age=3600",
							},
						},
					);
				}

				// Handle CORS preflight for OAuth discovery
				if (
					req.method === "OPTIONS" &&
					(url.pathname === "/.well-known/oauth-protected-resource" ||
						url.pathname === "/.well-known/oauth-authorization-server")
				) {
					return new Response(null, {
						status: 204,
						headers: {
							"Access-Control-Allow-Origin": "*",
							"Access-Control-Allow-Methods": "GET",
							"Access-Control-Allow-Headers": "Content-Type, Authorization",
						},
					});
				}

				// Default response for other paths/methods
				return new Response("Not Found", { status: 404 });
			},
			error(error: Error): Response {
				logFunc(`Bun server error: ${error}\n${error.stack}`);
				return new Response("Internal Server Error", { status: 500 });
			},
		});
		logFunc(
			` Bun server started successfully. Listening on http://localhost:${port} `,
		);
		logFunc("  SSE Endpoint: /sse");
		logFunc(
			`  Message Endpoint: ${messageEndpoint} (POST with ?sessionId=...)`,
		);
	}
}

main().catch((error) => {
	logFunc(`\x1b[31mFATAL: Server initialization failed: ${error}\x1b[0m`);
	if (error instanceof Error && error.stack) {
		logFunc(error.stack);
	}
	process.exit(1);
});

export { server };
