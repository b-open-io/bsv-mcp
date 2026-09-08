#!/usr/bin/env bun

// Must stay the first import. The stdio transport owns stdout for JSON-RPC, so
// the console redirect has to be installed before any other module initializes
// and gets a chance to log. This was previously a statement block below the
// imports, which cannot work: ES imports are evaluated before any top-level
// statement, so every dependency had already initialized by the time it ran.
import "./utils/stdioGuard";

import { readFile } from "node:fs/promises";
import path, { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	EXTENSION_ID,
	RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import {
	createMcpHandler,
	isLegacyRequest,
	type McpRequestContext,
	McpServer,
	SUPPORTED_PROTOCOL_VERSIONS,
	WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import packageJson from "./package.json";
import { registerAllPrompts } from "./prompts/index.ts";
import { registerResources } from "./resources/resources.ts";
import { getBsvPriceWithCache } from "./tools/bsv/getPrice.ts";
import {
	resolveToolCatalogFromEnvironment,
	resolveToolCatalogProfile,
} from "./tools/compactCatalog.ts";
import {
	registerAllTools,
	type ToolsConfig,
	type VaultMigrationStatus,
} from "./tools/index.ts";
import { IntegratedWallet } from "./tools/wallet/integratedWallet.ts";
import { Wallet } from "./tools/wallet/wallet.ts";
import { runAccountCommand } from "./utils/accountCommands";
import { accountDir, readAccount } from "./utils/accounts";
import {
	contentUrl,
	explorerFetch,
	explorerUrl,
	junglebusUrl,
	legacyOrdinalsUrl,
	readServices,
} from "./utils/backends";
import { assertBroadcastAllowed } from "./utils/broadcastGuard";
import { DroplitClient, readDroplitSponsorConfig } from "./utils/droplit";
import {
	initializeKeysForWalletMode,
	isExternalWalletContext,
	readExternalWalletConfig,
} from "./utils/externalWalletConfig";
import {
	type BSVJWTPayload,
	createMCPJWTValidator,
	generateWWWAuthenticate,
} from "./utils/jwtValidator.ts";
import { initializeSecureKeys } from "./utils/keyManager.ts";
import {
	registerAppResource,
	registerAppTool,
} from "./utils/mcpAppRegistration.ts";
import {
	getMcpSessionPrincipal,
	isMcpSessionPrincipalMatch,
	type McpSessionPrincipal,
} from "./utils/mcpSessionPrincipal.ts";
import {
	type ToolPolicyEra,
	withModernToolPolicy,
} from "./utils/modernToolPolicy.ts";
import { setServerInstance } from "./utils/passphrasePrompt.ts";
import {
	createProjectWalletRuntime,
	type ProjectWalletRuntime,
	readProjectWalletConfig,
} from "./utils/projectWalletRuntime";
import { inspectMigration } from "./utils/vaultMigration";
import {
	destroyWallet,
	initExternalWallet,
	initWallet,
	setSpendingApprovalServerInstance,
} from "./utils/walletInit.ts";

// Initialize server variable (used for stdio mode and passphrase detection)
let server: McpServer | undefined;

/** Options for createConfiguredServer */
interface ServerFactoryOptions {
	toolsConfig: ToolsConfig;
	wallet?: Wallet;
	ctx?: import("@1sat/actions").OneSatContext;
	loadPrompts: boolean;
	loadResources: boolean;
	era?: ToolPolicyEra;
}

type McpAppToolsConfig = {
	wallet?: Wallet;
	ctx?: import("@1sat/actions").OneSatContext;
	services?: import("@1sat/client").OneSatServices;
	externalWallet?: boolean;
	enableBsvTools?: boolean;
	enableOrdinalsTools?: boolean;
	enableWalletTools?: boolean;
	walletScope?: "full" | "payments";
	disableBroadcasting?: boolean;
	droplitMode?: boolean;
};

/**
 * Creates a fully configured McpServer with all tools, prompts, and resources registered.
 * Used to create per-session server instances for HTTP mode and the single instance for stdio.
 */
export function createConfiguredServer(opts: ServerFactoryOptions): McpServer {
	const nativeServer = new McpServer(
		{ name: packageJson.name, version: packageJson.version },
		{
			supportedProtocolVersions: SUPPORTED_MCP_PROTOCOL_VERSIONS,
			capabilities: {
				prompts: {},
				resources: {},
				tools: {},
				extensions: {
					[EXTENSION_ID]: { version: "0.1" },
				},
				experimental: {
					[EXTENSION_ID]: { version: "0.1" },
				},
			},
			instructions: `
				This server exposes Bitcoin SV helpers.
				Read tools do not spend. Payments, inscriptions, and other writes are not safe to retry after an unknown outcome; inspect wallet history first.
			`,
		},
	);
	const srv = withModernToolPolicy(nativeServer, opts.era ?? "legacy");

	registerAllTools(srv, opts.toolsConfig);
	if (resolveToolCatalogProfile(opts.toolsConfig) === "full") {
		registerMcpAppTools(srv, {
			...opts.toolsConfig,
			wallet: opts.wallet ?? opts.toolsConfig.wallet,
			ctx: opts.ctx ?? opts.toolsConfig.ctx,
			walletScope: opts.toolsConfig.walletScope,
			droplitMode: opts.toolsConfig.integratedWallet?.isDroplitMode === true,
		});
	}
	if (opts.loadPrompts) registerAllPrompts(srv);
	if (opts.loadResources) registerResources(srv);

	return srv;
}

/**
 * Configuration options from environment variables
 */
export const CONFIG = {
	// Whether to load various components
	loadPrompts: process.env.DISABLE_PROMPTS !== "true",
	loadResources: process.env.DISABLE_RESOURCES !== "true",
	loadTools: process.env.DISABLE_TOOLS !== "true",
	toolCatalog: resolveToolCatalogFromEnvironment(),

	// Fine-grained tool category control (dependent on key availability)
	loadWalletTools: process.env.DISABLE_WALLET_TOOLS !== "true",
	loadMneeTools: process.env.DISABLE_MNEE_TOOLS !== "true",
	loadBsvTools: process.env.DISABLE_BSV_TOOLS !== "true",
	loadOrdinalsTools: process.env.DISABLE_ORDINALS_TOOLS !== "true",
	loadUtilsTools: process.env.DISABLE_UTILS_TOOLS !== "true",
	loadBapTools: process.env.DISABLE_BAP_TOOLS !== "true",
	loadBsocialTools: process.env.DISABLE_BSOCIAL_TOOLS !== "true",
	// Transaction broadcasting control
	disableBroadcasting: process.env.DISABLE_BROADCASTING === "true",

	// --- Transport Mode ---
	// --stdio CLI flag takes precedence over TRANSPORT env var (matches neighborhood plugin pattern)
	transportMode: process.argv.includes("--stdio")
		? "stdio"
		: process.env.TRANSPORT?.toLowerCase() || "http", // 'stdio' or 'http'/default
	port: Number.parseInt(process.env.PORT || "3000", 10),

	// --- Droplit API Configuration ---
	useDroplitApi: process.env.USE_DROPLIT_API === "true",
	droplitApiUrl: process.env.DROPLIT_API_URL || "http://127.0.0.1:4000",
	droplitFaucetName: process.env.DROPLIT_FAUCET_NAME || "",

	// --- OAuth Configuration ---
	enableOAuth: process.env.ENABLE_OAUTH !== "false", // Enabled by default
	oauthIssuer: process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com",
	resourceUrl: process.env.RESOURCE_URL || "", // Will be set based on port
};

// Advertise both protocol eras. v2 defaults to the legacy handshake unless a
// client explicitly negotiates the modern revision, so retaining the legacy
// entry keeps existing clients working while enabling 2026 discovery.
const SUPPORTED_MCP_PROTOCOL_VERSIONS = [
	...SUPPORTED_PROTOCOL_VERSIONS,
	"2026-07-28",
];

const logFunc = console.error;
const KEY_FILE_PATH = path.join(accountDir(), "keys.bep");
const initializeKeys = initializeSecureKeys;

type KeySource = "encrypted" | "env" | "none" | "external";

/**
 * BAP generation is advertised only when startup loaded the selected local
 * encrypted account. This is an advisory startup snapshot, not an unlock
 * guarantee for a later tool invocation.
 */
export function shouldAdvertiseLocalAccount(
	keySource: KeySource,
	externalWallet: boolean,
	useDroplitApi: boolean,
): boolean {
	return keySource === "encrypted" && !externalWallet && !useDroplitApi;
}

// --- MCP App Tools & Resource ---
const APP_RESOURCE_URI = "ui://bsv-mcp/app.html";
const __appDirname = dirname(fileURLToPath(import.meta.url));

function registerMcpAppTools(server: McpServer, config: McpAppToolsConfig) {
	// App tools consume the same category switches as their direct-tool
	// counterparts. The app dashboard and resource remain available as the
	// entry point even when all data categories are disabled.
	const bsvToolsEnabled =
		process.env.DISABLE_TOOLS !== "true" &&
		process.env.DISABLE_BSV_TOOLS !== "true" &&
		config.enableBsvTools !== false;
	const ordinalsToolsEnabled =
		process.env.DISABLE_TOOLS !== "true" &&
		process.env.DISABLE_ORDINALS_TOOLS !== "true" &&
		config.enableOrdinalsTools !== false;
	const walletToolsEnabled =
		process.env.DISABLE_TOOLS !== "true" &&
		process.env.DISABLE_WALLET_TOOLS !== "true" &&
		config.enableWalletTools !== false;
	const appServices = config.ctx?.services ?? config.services;
	const walletAvailable =
		!config.droplitMode && Boolean(config.ctx || config.wallet);
	const externalWallet =
		config.externalWallet ??
		(isExternalWalletContext(config.ctx) || config.ctx?.isBaseWallet === false);
	const wholeWalletBalanceAvailable =
		walletAvailable && !externalWallet && config.walletScope !== "payments";
	const sweepPrepareAvailable = Boolean(
		config.walletScope !== "payments" &&
			config.ctx &&
			appServices &&
			typeof config.ctx.wallet.createAction === "function",
	);
	const sweepCompleteAvailable = Boolean(
		config.walletScope !== "payments" &&
			config.ctx &&
			appServices &&
			typeof config.ctx.wallet.signAction === "function",
	);
	const broadcastingEnabled =
		process.env.DISABLE_BROADCASTING !== "true" &&
		config.disableBroadcasting !== true;
	const ctx = config.ctx;
	const wallet = config.wallet;
	const disableBroadcasting = config.disableBroadcasting ?? false;
	// Primary dashboard tool — model calls this to open the UI
	registerAppTool(
		server,
		"bsv_dashboard",
		{
			title: "BSV Dashboard",
			description:
				"Interactive BSV dashboard with Explorer, Wallet, and Ordinals tabs. Use this for any BSV-related query that benefits from visual display.",
			inputSchema: z.object({}),
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
			_meta: {
				ui: { resourceUri: APP_RESOURCE_URI },
			},
		},
		async () => {
			return {
				content: [{ type: "text" as const, text: "BSV Dashboard opened" }],
				structuredContent: { view: "dashboard", ready: true },
			};
		},
	);

	// App-only: fetch explorer data (price, chain info, tx decode, address lookup)
	if (bsvToolsEnabled) {
		registerAppTool(
			server,
			"app_explorer_data",
			{
				title: "Explorer Data",
				description:
					"App-only: fetches BSV price, chain info, decodes transactions, and looks up addresses.",
				inputSchema: z.object({
					txid: z.string().optional().describe("Transaction ID to decode"),
					address: z
						.string()
						.optional()
						.describe("Address to look up balance/history"),
				}),
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
							`${junglebusUrl()}/transaction/get/${txid}`,
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
						};
					}
				}

				// If address provided, look up balance and history
				if (address) {
					try {
						const [balRes, histRes] = await Promise.all([
							explorerFetch(`${explorerUrl()}/address/${address}/balance`),
							explorerFetch(`${explorerUrl()}/address/${address}/history`),
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
						};
					}
				}

				// Default: return price + chain info
				try {
					const [price, chainRes] = await Promise.all([
						getBsvPriceWithCache(),
						explorerFetch(`${explorerUrl()}/chain/info`),
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
					};
				}
			},
		);
	}

	// App-only: fetch wallet data (uses BRC-100 context to match direct tools)
	if (walletToolsEnabled && wholeWalletBalanceAvailable) {
		registerAppTool(
			server,
			"app_wallet_data",
			{
				title: "Wallet Data",
				description: "App-only: fetches wallet balance, UTXOs, and address.",
				inputSchema: z.object({}),
				_meta: {
					ui: { resourceUri: APP_RESOURCE_URI, visibility: ["app"] },
				},
			},
			async () => {
				if (!ctx && !wallet) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No wallet configured",
							},
						],
						structuredContent: {
							error:
								"No wallet configured. Set PRIVATE_KEY_WIF or generate keys.",
						},
					};
				}

				try {
					let address: string | undefined;
					let totalSatoshis = 0;
					let utxoCount = 0;
					let utxos: Array<{ txid: string; vout: number; satoshis: number }> =
						[];

					// Use BRC-100 context (same source as wallet_getAddress / wallet_getBalance)
					if (ctx) {
						const { deriveDepositAddresses } = await import("@1sat/actions");
						const { derivations } = await deriveDepositAddresses.execute(ctx, {
							prefix: "mcp",
						});
						address = derivations[0]?.address;

						const result = await ctx.wallet.listOutputs({ basket: "default" });
						totalSatoshis = result.outputs.reduce(
							(sum, output) => sum + output.satoshis,
							0,
						);
						utxoCount = result.totalOutputs;
						utxos = result.outputs.slice(0, 50).map((o) => {
							const [txid = "", voutStr = "0"] = (o.outpoint ?? "").split(".");
							return { txid, vout: Number(voutStr), satoshis: o.satoshis };
						});
					} else if (wallet) {
						// Fallback to local wallet if no BRC-100 context
						address = wallet.getAddress();
						const { paymentUtxos } = await wallet.getUtxos();
						for (const utxo of paymentUtxos) {
							totalSatoshis += utxo.satoshis || 0;
						}
						utxoCount = paymentUtxos.length;
						utxos = paymentUtxos.slice(0, 50).map((u) => ({
							txid: u.txid,
							vout: u.vout,
							satoshis: u.satoshis,
						}));
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
								utxoCount,
							},
							address,
							utxos,
							price,
						},
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
					};
				}
			},
		);
	}

	// App-only: fetch ordinals data
	if (ordinalsToolsEnabled) {
		registerAppTool(
			server,
			"app_ordinals_data",
			{
				title: "Ordinals Data",
				description:
					"App-only: fetches ordinals/NFT marketplace listings and search results.",
				inputSchema: z.object({
					query: z.string().optional().describe("Search query"),
				}),
				_meta: {
					ui: { resourceUri: APP_RESOURCE_URI, visibility: ["app"] },
				},
			},
			async (args) => {
				const { query } = args as { query?: string };

				try {
					const services = readServices(appServices);
					const listings = await services.market.searchListings({
						q: query || undefined,
						limit: 20,
						status: "active",
						rev: true,
					});
					return {
						content: [
							{ type: "text" as const, text: "Marketplace listings loaded" },
						],
						structuredContent: {
							listings,
							total: listings.length,
							contentBaseUrl: contentUrl(services.baseUrl),
						},
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
					};
				}
			},
		);
	}

	// App-only: scan an address for categorized UTXOs (funding, ordinals, BSV-21 tokens)
	if (ordinalsToolsEnabled) {
		registerAppTool(
			server,
			"app_sweep_scan",
			{
				title: "Sweep Scan",
				description:
					"App-only: scans a Bitcoin address for categorized UTXOs — funding, ordinals, and BSV-21 tokens.",
				inputSchema: z.object({
					address: z.string().describe("Bitcoin address to scan"),
				}),
				_meta: {
					ui: { resourceUri: APP_RESOURCE_URI, visibility: ["app"] },
				},
			},
			async (args) => {
				const { address } = args as { address: string };
				try {
					const res = await fetch(
						`${legacyOrdinalsUrl()}/txos/address/${address}/unspent?limit=1000`,
					);
					if (!res.ok) throw new Error(`GorillaPool API error: ${res.status}`);
					const utxos = (await res.json()) as Array<Record<string, unknown>>;

					const funding: Array<{
						outpoint: string;
						satoshis: number;
						lockingScript: string;
					}> = [];
					const ordinals: Array<{
						outpoint: string;
						satoshis: number;
						lockingScript: string;
					}> = [];
					const bsv21Raw: Array<{
						outpoint: string;
						satoshis: number;
						lockingScript: string;
						tokenId: string;
						amount: string;
						sym?: string;
						dec: number;
					}> = [];

					for (const utxo of utxos) {
						const txid = utxo.txid as string;
						const vout = utxo.vout as number;
						const outpoint = `${txid}_${vout}`;
						const satoshis = (utxo.satoshis as number) || 0;
						const script = (utxo.script as string) || "";
						const origin = utxo.origin as Record<string, unknown> | undefined;
						const originData = origin?.data as
							| Record<string, unknown>
							| undefined;

						const base = { outpoint, satoshis, lockingScript: script };

						if (originData?.bsv21) {
							const bsv21 = originData.bsv21 as Record<string, unknown>;
							bsv21Raw.push({
								...base,
								tokenId: (bsv21.id as string) || "",
								amount: (bsv21.amt as string) || "0",
								sym: bsv21.sym as string | undefined,
								dec: (bsv21.dec as number) ?? 0,
							});
						} else if (originData?.insc || origin?.outpoint) {
							ordinals.push(base);
						} else {
							funding.push(base);
						}
					}

					// Group BSV-21 tokens by tokenId
					const tokenGroups = new Map<
						string,
						{
							inputs: typeof bsv21Raw;
							sym?: string;
							dec: number;
						}
					>();
					for (const item of bsv21Raw) {
						let group = tokenGroups.get(item.tokenId);
						if (!group) {
							group = { inputs: [], sym: item.sym, dec: item.dec };
							tokenGroups.set(item.tokenId, group);
						}
						group.inputs.push(item);
					}

					const bsv21Tokens: Array<{
						tokenId: string;
						symbol?: string;
						decimals: number;
						totalAmount: string;
						inputs: typeof bsv21Raw;
					}> = [];
					for (const [tokenId, group] of tokenGroups) {
						let total = BigInt(0);
						for (const inp of group.inputs) {
							total += BigInt(inp.amount);
						}
						bsv21Tokens.push({
							tokenId,
							symbol: group.sym,
							decimals: group.dec,
							totalAmount: total.toString(),
							inputs: group.inputs,
						});
					}

					const totalFundingSats = funding.reduce(
						(sum, f) => sum + f.satoshis,
						0,
					);

					return {
						content: [
							{
								type: "text" as const,
								text: `Scanned ${address}: ${funding.length} funding, ${ordinals.length} ordinals, ${bsv21Tokens.length} token types`,
							},
						],
						structuredContent: {
							address,
							funding,
							ordinals,
							bsv21Tokens,
							totalFundingSats,
						},
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
					};
				}
			},
		);
	}

	// App-only: prepare unsigned sweep transaction for client-side signing
	if (walletToolsEnabled && sweepPrepareAvailable) {
		registerAppTool(
			server,
			"app_sweep_prepare",
			{
				title: "Sweep Prepare",
				description:
					"App-only: builds an unsigned sweep transaction. Returns BEEF hex and reference for client-side signing.",
				inputSchema: z.object({
					sweepType: z
						.enum(["bsv", "ordinals", "bsv21"])
						.describe("Type of assets to sweep"),
					inputs: z
						.array(
							z.object({
								outpoint: z.string().describe("Outpoint (txid_vout)"),
								satoshis: z.number().int().describe("Satoshis in output"),
								lockingScript: z.string().describe("Locking script hex"),
							}),
						)
						.describe("UTXOs to sweep"),
				}),
				_meta: {
					ui: { resourceUri: APP_RESOURCE_URI, visibility: ["app"] },
				},
			},
			async (args) => {
				const { sweepType, inputs } = args as {
					sweepType: "bsv" | "ordinals" | "bsv21";
					inputs: Array<{
						outpoint: string;
						satoshis: number;
						lockingScript: string;
					}>;
				};

				if (!ctx || !appServices) {
					return {
						content: [
							{
								type: "text" as const,
								text: "BRC-100 wallet context not available",
							},
						],
						structuredContent: { error: "No wallet context" },
					};
				}

				try {
					if (!appServices) throw new Error("Services not available");
					if (!inputs.length) throw new Error("No inputs provided");

					// Fetch and merge BEEF for all input transactions
					const txids = [
						...new Set(
							inputs.map((i) => {
								const txid = i.outpoint.split("_")[0];
								if (!txid) throw new Error("Invalid input outpoint");
								return txid;
							}),
						),
					];
					const [firstTxid, ...remainingTxids] = txids;
					if (!firstTxid) throw new Error("No input transactions provided");
					const firstBeef = await appServices.getBeefForTxid(firstTxid);
					for (const txid of remainingTxids) {
						const additionalBeef = await appServices.getBeefForTxid(txid);
						firstBeef.mergeBeef(additionalBeef);
					}

					// Build input descriptors using SDK format (txid.vout)
					const inputDescriptors = inputs.map((input) => {
						const [txid, voutStr] = input.outpoint.split("_");
						return {
							outpoint: `${txid}.${Number(voutStr)}`,
							inputDescription: `Sweep ${sweepType} input`,
							unlockingScriptLength: 108,
							sequenceNumber: 0xffffffff,
						};
					});

					const inputTotal = inputs.reduce((sum, i) => sum + i.satoshis, 0);

					const createResult = await ctx.wallet.createAction({
						description: `Sweep ${inputTotal} sats (${sweepType})`,
						inputBEEF: firstBeef.toBinary(),
						inputs: inputDescriptors,
						outputs: [],
						options: {
							signAndProcess: false,
							...(sweepType !== "bsv" && {
								randomizeOutputs: false,
							}),
						},
					});

					if ("error" in createResult && createResult.error) {
						throw new Error(String(createResult.error));
					}
					if (!createResult.signableTransaction) {
						throw new Error("No signable transaction returned");
					}

					// Map our inputs to their indices in the transaction
					const { Transaction: TxClass, Utils: SdkUtils } = await import(
						"@bsv/sdk"
					);
					const tx = TxClass.fromBEEF(createResult.signableTransaction.tx);
					const ourOutpoints = new Set(
						inputs.map((i) => {
							const [txid, voutStr] = i.outpoint.split("_");
							return `${txid}.${Number(voutStr)}`;
						}),
					);

					const inputsToSign: Array<{
						index: number;
						outpoint: string;
						satoshis: number;
						lockingScript: string;
					}> = [];
					for (const [idx, txInput] of tx.inputs.entries()) {
						const op = `${txInput.sourceTXID}.${txInput.sourceOutputIndex}`;
						if (ourOutpoints.has(op)) {
							const match = inputs.find((i) => {
								const [t, v] = i.outpoint.split("_");
								return `${t}.${Number(v)}` === op;
							});
							if (match) {
								inputsToSign.push({
									index: idx,
									outpoint: match.outpoint,
									satoshis: match.satoshis,
									lockingScript: match.lockingScript,
								});
							}
						}
					}

					const txHex = SdkUtils.toHex(createResult.signableTransaction.tx);

					return {
						content: [
							{
								type: "text" as const,
								text: `Prepared ${sweepType} sweep: ${inputsToSign.length} inputs to sign`,
							},
						],
						structuredContent: {
							txHex,
							reference: createResult.signableTransaction.reference,
							inputsToSign,
						},
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
					};
				}
			},
		);
	}

	// App-only: complete a sweep by broadcasting with client-signed spends
	if (walletToolsEnabled && sweepCompleteAvailable && broadcastingEnabled) {
		registerAppTool(
			server,
			"app_sweep_complete",
			{
				title: "Sweep Complete",
				description:
					"App-only: completes a sweep by broadcasting the transaction with client-signed unlocking scripts.",
				inputSchema: z.object({
					reference: z
						.string()
						.describe("Opaque reference from app_sweep_prepare"),
					spends: z
						.record(
							z.string(),
							z.object({
								unlockingScript: z
									.string()
									.describe("Signed unlocking script hex"),
							}),
						)
						.describe("Map of input index to signed unlocking script"),
				}),
				_meta: {
					ui: { resourceUri: APP_RESOURCE_URI, visibility: ["app"] },
				},
			},
			async (args) => {
				const { reference, spends } = args as {
					reference: string;
					spends: Record<number, { unlockingScript: string }>;
				};

				if (!ctx || !appServices) {
					return {
						content: [
							{
								type: "text" as const,
								text: "BRC-100 wallet context not available",
							},
						],
						structuredContent: { error: "No wallet context" },
					};
				}

				try {
					assertBroadcastAllowed("app_sweep_complete", disableBroadcasting);
					const signResult = await ctx.wallet.signAction({
						reference,
						spends,
						options: { acceptDelayedBroadcast: false },
					});

					if ("error" in signResult) {
						throw new Error(String(signResult.error));
					}

					return {
						content: [
							{
								type: "text" as const,
								text: `Sweep broadcast: ${signResult.txid}`,
							},
						],
						structuredContent: {
							txid: signResult.txid,
							success: true,
						},
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
					};
				}
			},
		);
	}

	// Register the HTML resource
	registerAppResource(
		server,
		"BSV Dashboard",
		APP_RESOURCE_URI,
		{
			description:
				"Interactive BSV dashboard with Explorer, Wallet, and Ordinals tabs",
		},
		async () => {
			// When running from bundle (dist/index.js), app.html is a sibling.
			// When running from source (index.ts), it's in dist/.
			const distPath = __appDirname.endsWith("dist")
				? join(__appDirname, "app.html")
				: join(__appDirname, "dist", "app.html");
			let html: string;
			try {
				html = await readFile(distPath, "utf-8");
			} catch {
				html =
					"<html><body><p>Dashboard not built. Run <code>bun run build:view</code> to enable it.</p></body></html>";
			}
			return {
				contents: [
					{
						uri: APP_RESOURCE_URI,
						mimeType: RESOURCE_MIME_TYPE,
						text: html,
						_meta: {
							ui: {
								csp: {
									resourceDomains: [
										new URL(contentUrl(appServices?.baseUrl)).origin,
										"https://fonts.googleapis.com",
										"https://fonts.gstatic.com",
									],
								},
							},
						},
					},
				],
			};
		},
	);
}

// --- Main Server Setup ---
export async function main() {
	// Check for help or info commands that don't need authentication
	const args = process.argv.slice(2);
	if (args[0] === "vault-setup") {
		if (args.length !== 1) throw new Error("vault-setup does not accept arguments; configure the explicit project and Vault through environment settings");
		const { runConfiguredVaultSetup } = await import("./utils/vaultSetupBootstrap");
		await runConfiguredVaultSetup();
		return;
	}
	if (await runAccountCommand(args)) return;
	if (args.includes("--help") || args.includes("-h") || args.includes("help")) {
		console.log(`
BSV MCP Server v${packageJson.version}

Usage: bun run index.ts [options]

Options:
  --help, -h          Show this help message
  --version, -v       Show version information
  vault-setup         Open the local read-only Vault migration preview

Environment Variables:
  TRANSPORT           Transport mode: 'stdio' or 'http' (default: http)
  PORT               HTTP server port (default: 3000)
  BRC100_WALLET_URL  Existing SDK HTTPWalletJSON signer RPC URL
  BRC100_WALLET_ORIGINATOR  Signer permission origin (default: bsv-mcp.local)
  BSV_MCP_PROJECT_ROOT  Explicit absolute project root for project stdio mode
  BSV_MCP_PROJECT_ID    Paired project identifier for project stdio mode
  VAULT_PATH            Optional project Vault file path (absolute)
  PRIVATE_KEY_WIF    Legacy payment key input; prefer Vault
  DISABLE_TOOLS      Disable all tools (default: false)
  MCP_TOOL_CATALOG   Tool catalog: 'full' or 'compact' (default: full; invalid values fail startup)
  DISABLE_WALLET_TOOLS   Disable wallet tools (default: false)
  DISABLE_BSV_TOOLS      Disable BSV tools (default: false)
  DISABLE_ORDINALS_TOOLS Disable ordinals tools (default: false)
  DISABLE_UTILS_TOOLS    Disable utility tools (default: false)
  DISABLE_BAP_TOOLS      Disable BAP tools (default: false)  
  DISABLE_BSOCIAL_TOOLS  Disable BSocial tools (default: false)
  DISABLE_BROADCASTING   Disable transaction broadcasting (default: false)
  USE_DROPLIT_API        Use Droplit API for transactions (default: false)

Tool Categories:
  BSV Tools:      Price lookup, transaction decoding, validation
  Wallet Tools:   Send payments, manage UTXOs (requires payment key)
  Ordinals Tools: Search listings, market data
  Utils Tools:    General utilities, conversions
  BAP Tools:      Identity management (requires identity key)
  BSocial Tools:  Social posts, likes, follows

Authentication:
  - Most tools work without authentication
  - Wallet operations use BRC100_WALLET_URL, an initialized encrypted account or legacy environment keys
  - Environment WIFs are legacy compatibility inputs and trigger a migration warning
  - BAP tools require identity keys (generated via bap_generate tool)
		`);
		process.exit(0);
	}

	if (args.includes("--version") || args.includes("-v")) {
		console.log(`${packageJson.name} v${packageJson.version}`);
		process.exit(0);
	}

	// --- Initialize Keys ---
	// Project selectors are consumed before any legacy account, WIF, external
	// signer, or Droplit branch. The project runtime owns one explicitly bound
	// Vault role and is available only to the local stdio child.
	const projectConfig = readProjectWalletConfig();
	const projectRuntime: ProjectWalletRuntime | undefined = projectConfig
		? await createProjectWalletRuntime()
		: undefined;
	const externalWallet = projectRuntime
		? undefined
		: readExternalWalletConfig();
	const sponsorConfig = projectRuntime
		? undefined
		: CONFIG.useDroplitApi
			? undefined
			: readDroplitSponsorConfig();
	let vaultMigration: VaultMigrationStatus = {
		available: !externalWallet && !projectRuntime,
		required: false,
		sources: 0,
		environmentKeys: { payment: false, identity: false },
		nextStep: projectRuntime
			? "An explicit project Vault role is selected; local account migration is not applicable."
			: externalWallet
				? "An external signer is selected; local key migration is not applicable."
				: "No legacy key source was detected. Vault migration is still pending.",
	};
	if (!externalWallet && !projectRuntime) {
		try {
			const migration = inspectMigration();
			vaultMigration = {
				available: true,
				required: migration.migrationRequired,
				sources: migration.sources.length,
				environmentKeys: {
					payment: migration.environmentKeys.payment,
					identity: migration.environmentKeys.identity,
				},
				nextStep: migration.migrationRequired
					? "Run bsv-mcp vault-setup locally to inspect the detected source. Import into Vault is not enabled yet."
					: "No legacy key source was detected. Vault migration is still pending.",
			};
			if (migration.migrationRequired) {
				logFunc(
					"\x1b[33mWARN: Vault migration is pending. Run bsv-mcp vault-setup locally for a read-only inventory; import remains unavailable until Vault integration is enabled.\x1b[0m",
				);
			}
		} catch {
			vaultMigration = {
				available: true,
				required: true,
				sources: 0,
				environmentKeys: { payment: false, identity: false },
				nextStep:
					"Run bsv-mcp vault-setup locally to inspect the key configuration.",
			};
			logFunc(
				"\x1b[33mWARN: BSV MCP could not verify the local key layout. Run bsv-mcp vault-setup locally before using wallet tools.\x1b[0m",
			);
		}
	}
	const keys = projectRuntime
		? {
				payPk: undefined,
				identityPk: undefined,
				xprv: undefined,
				source: "none" as const,
			}
		: await initializeKeysForWalletMode(externalWallet, async () =>
				CONFIG.loadTools && CONFIG.loadWalletTools && !CONFIG.useDroplitApi
					? initializeKeys()
					: {
							payPk: undefined,
							identityPk: undefined,
							xprv: undefined,
							source: "none" as const,
						},
			);
	const {
		payPk,
		identityPk,
		xprv,
		source: keySource,
	} = keys ?? {
		payPk: undefined,
		identityPk: undefined,
		xprv: undefined,
		source: "external",
	};
	if (!externalWallet && payPk) {
		const account = readAccount();
		if (account) {
			if (process.env.BSV_CHAIN && process.env.BSV_CHAIN !== account.chain)
				throw new Error("BSV_CHAIN conflicts with the account network");
			process.env.BSV_CHAIN = account.chain;
		}
	}

	// Define persistence based on source
	const hasPersistentPayKey = keySource === "env" || keySource === "encrypted";
	const hasPersistentIdentityKey = !!identityPk && keySource === "encrypted";
	const hasXprv = !!xprv && keySource === "encrypted";

	const effectiveConfig = { ...CONFIG, bapPublicOnly: CONFIG.useDroplitApi };
	if (projectRuntime) {
		// A payment role is deliberately narrower than a general embedded
		// account. Identity signing, encryption, and OneSat asset operations need
		// their own explicitly assigned role and are not authorized by this ctx.
		effectiveConfig.bapPublicOnly = true;
		effectiveConfig.loadOrdinalsTools = false;
		effectiveConfig.loadMneeTools = false;
		effectiveConfig.loadBapTools = false;
	} else if (externalWallet) {
		effectiveConfig.bapPublicOnly = true;
		effectiveConfig.loadBsocialTools = false;
		effectiveConfig.loadMneeTools = false;
		logFunc(
			"External BRC-100 signer selected; local key loading and generation bypassed.",
		);
	}

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
		`  PRIVATE_KEY_WIF:      ${projectRuntime ? "Unused (project Vault role)" : externalWallet ? "Unused (external signer)" : process.env.PRIVATE_KEY_WIF ? "Set (using env key)" : "Not Set (using selected account)"}`,
	);
	logFunc(
		`  IDENTITY_KEY_WIF:     ${projectRuntime ? "Unused (project Vault role)" : externalWallet ? "Unused (external signer)" : process.env.IDENTITY_KEY_WIF ? "Set (using env key)" : "Not Set (using selected account)"}`,
	);
	if (!externalWallet && keySource === "env") {
		logFunc(
			"\x1b[33mWARN: Environment WIF keys are a legacy compatibility path. Move them into Vault and remove PRIVATE_KEY_WIF and IDENTITY_KEY_WIF when migration is complete.\x1b[0m",
		);
	}
	if (process.env.BSV_MCP_PASSPHRASE) {
		logFunc("  BSV_MCP_PASSPHRASE:   Deprecated; use BSV_MCP_PASSWORD");
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
	logFunc(`  MCP_TOOL_CATALOG:    ${CONFIG.toolCatalog}`);
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
		`  DISABLE_BAP_TOOLS:    ${process.env.DISABLE_BAP_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`,
	);
	logFunc(
		`  DISABLE_BROADCASTING: ${process.env.DISABLE_BROADCASTING === "true" ? "Set (true)" : "Not Set/false"}`,
	);
	logFunc(
		`  USE_DROPLIT_API:      ${CONFIG.useDroplitApi ? "Set (true)" : "Not Set/false"}`,
	);
	if (CONFIG.useDroplitApi) {
		logFunc(`  DROPLIT_API_URL:      ${CONFIG.droplitApiUrl}`);
		logFunc(`  DROPLIT_FAUCET_NAME:  ${CONFIG.droplitFaucetName || "Not Set"}`);
	}

	logFunc("\nKey Source:");
	let payKeySourceInfo = `Payment Key (payPk): ${keySource}`;
	if (keySource === "env") payKeySourceInfo = "Payment Key (payPk): env";
	if (keySource === "encrypted")
		payKeySourceInfo += ` (Loaded from ${KEY_FILE_PATH})`;

	let identityKeySourceInfo = "Identity Key (identityPk): Not Loaded";
	if (identityPk && keySource === "encrypted") {
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
		const bapStatus = effectiveConfig.loadBapTools
			? "\x1b[32mEnabled\x1b[0m"
			: "\x1b[31mDisabled\x1b[0m";

		let payKeyNote = "";
		if (!projectRuntime && !externalWallet && !hasPersistentPayKey) {
			payKeyNote = " \x1b[33m(Using generated payPk)\x1b[0m";
		}
		let identityKeyNote = "";
		if (!projectRuntime && !externalWallet && !hasPersistentIdentityKey) {
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

	// --- Initialize Wallet & Tools Config ---
	let wallet: Wallet | undefined;
	let integratedWallet: IntegratedWallet | undefined;
	let remoteCtx: import("@1sat/actions").OneSatContext | undefined;
	let remoteServices: import("@1sat/client").OneSatServices | undefined;

	if (CONFIG.loadTools) {
		// Check if we should use Droplit API mode
		if (projectRuntime) {
			remoteCtx = projectRuntime.ctx;
			remoteServices = projectRuntime.services;
			logFunc(
				`Project payments wallet ready for ${projectRuntime.projectId}. Deposit address: ${projectRuntime.depositAddress}`,
			);
		} else if (externalWallet) {
			const chain = process.env.BSV_CHAIN ?? "main";
			if (chain !== "main" && chain !== "test")
				throw new Error("BSV_CHAIN must be main or test");
			const result = await initExternalWallet(externalWallet, chain);
			remoteCtx = result.ctx;
			remoteServices = result.services;
			logFunc(`External BRC-100 signer ready. Identity: ${result.identityKey}`);
		} else if (CONFIG.useDroplitApi && CONFIG.droplitFaucetName) {
			// Initialize IntegratedWallet in Droplit mode
			if (CONFIG.loadWalletTools) {
				try {
					integratedWallet = new IntegratedWallet({
						useDroplitApi: true,
						droplitConfig: {
							apiUrl: CONFIG.droplitApiUrl,
							faucetName: CONFIG.droplitFaucetName,
						},
						paymentKey: payPk,
						identityKey: identityPk,
					});
					logFunc(
						`\x1b[32mINFO: Droplit API mode initialized successfully (Faucet: ${CONFIG.droplitFaucetName}).\x1b[0m`,
					);
					logFunc(
						`\x1b[33mNOTE: Using Droplit API at ${CONFIG.droplitApiUrl}\x1b[0m`,
					);
					logFunc(
						"\x1b[33mNOTE: Local keys are ignored in Droplit API mode\x1b[0m",
					);
					wallet = integratedWallet.getLocalWallet();

					effectiveConfig.loadMneeTools = false;
					effectiveConfig.bapPublicOnly = true;
					effectiveConfig.loadBsocialTools = false;
				} catch (e) {
					logFunc(
						`\x1b[31mERROR: Failed to initialize Droplit API mode: ${e instanceof Error ? e.message : String(e)}. Wallet-dependent tools will be unavailable.\x1b[0m`,
					);
					integratedWallet = undefined;
					effectiveConfig.loadWalletTools = false;
					effectiveConfig.loadMneeTools = false;
					effectiveConfig.bapPublicOnly = true;
				}
			}
		} else if (payPk) {
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
						logFunc("Wallet payment key is not persistent");
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

				// Initialize remote BRC-100 wallet alongside the local wallet
				try {
					const chain =
						readAccount()?.chain ??
						(process.env.BSV_CHAIN === "test" ? "test" : "main");
					const remoteResult = await initWallet(payPk.toWif(), chain);
					remoteCtx = remoteResult.ctx;
					remoteServices = remoteResult.services;
					logFunc(
						`\x1b[32mINFO: Remote BRC-100 wallet initialized. Deposit address: ${remoteResult.depositAddress}\x1b[0m`,
					);
				} catch (e) {
					logFunc(
						"Named wallet initialization failed; no fallback wallet will be used",
					);
					throw new Error(
						"Named wallet initialization failed; check the account configuration",
						{ cause: e },
					);
				}
			}

			if (effectiveConfig.loadMneeTools && !wallet && CONFIG.loadWalletTools) {
				logFunc(
					"\x1b[33mWARN: MNEE tools require a wallet but wallet initialization failed. MNEE tools disabled.\x1b[0m",
				);
				effectiveConfig.loadMneeTools = false;
			}
		}
	}

	const droplitClient =
		sponsorConfig && remoteCtx
			? new DroplitClient({ ...sponsorConfig, wallet: remoteCtx.wallet })
			: undefined;
	if (sponsorConfig && CONFIG.loadTools && !remoteCtx) {
		throw new Error(
			"Configured Droplit sponsor requires an initialized BRC-100 wallet context",
		);
	}

	// Build the shared tools config (used by server factory for each session)
	const toolsConfig: ToolsConfig = CONFIG.loadTools
		? {
				toolCatalog: CONFIG.toolCatalog,
				vaultMigration,
				localAccountAvailable: shouldAdvertiseLocalAccount(
					keySource,
					!!externalWallet,
					CONFIG.useDroplitApi,
				),
				externalWallet: !!externalWallet,
				enableAccountTools:
					!externalWallet && !projectRuntime && !CONFIG.useDroplitApi,
				enableBsvTools: effectiveConfig.loadBsvTools,
				enableOrdinalsTools:
					!projectRuntime && effectiveConfig.loadOrdinalsTools,
				enableUtilsTools: effectiveConfig.loadUtilsTools,
				enableBapTools: !projectRuntime && effectiveConfig.loadBapTools,
				enableBsocialTools: effectiveConfig.loadBsocialTools,
				enableWalletTools: effectiveConfig.loadWalletTools,
				enableMneeTools: !projectRuntime && effectiveConfig.loadMneeTools,
				walletScope: projectRuntime ? "payments" : "full",
				identityPk,
				payPk,
				xprv,
				wallet,
				integratedWallet,
				bapPublicOnly: effectiveConfig.bapPublicOnly,
				disableBroadcasting: effectiveConfig.disableBroadcasting,
				ctx: remoteCtx,
				services: remoteServices,
				droplitClient,
			}
		: {
				toolCatalog: CONFIG.toolCatalog,
				enableBsvTools: false,
				enableOrdinalsTools: false,
				enableUtilsTools: false,
				enableBapTools: false,
				enableBsocialTools: false,
				enableWalletTools: false,
				enableMneeTools: false,
				disableBroadcasting: true,
			};

	const serverFactoryOpts: ServerFactoryOptions = {
		toolsConfig,
		wallet,
		ctx: remoteCtx,
		loadPrompts: effectiveConfig.loadPrompts,
		loadResources: effectiveConfig.loadResources,
	};

	// Clean up remote wallet on shutdown
	for (const sig of ["SIGINT", "SIGTERM"] as const) {
		process.once(sig, () => {
			Promise.allSettled([projectRuntime?.cleanup(), destroyWallet()]).catch(
				() => {},
			);
		});
	}

	// Start the server based on transport mode
	if (CONFIG.transportMode === "stdio") {
		// v2 owns the transport and pins the factory-created server to the
		// negotiated era. Set the helper globals inside the factory: serveStdio
		// may create a probe instance before selecting the connection instance.
		serveStdio(
			(requestContext: McpRequestContext) => {
				const configured = createConfiguredServer({
					...serverFactoryOpts,
					era: requestContext.era,
				});
				server = configured;
				setServerInstance(configured);
				setSpendingApprovalServerInstance(configured);
				return configured;
			},
			{
				legacy: "serve",
				onerror: (error) => logFunc(`MCP stdio error: ${error}`),
			},
		);
		logFunc("BSV MCP Server running on stdio");
	} else {
		// --- HTTP: Streamable HTTP transport (MCP 2025-03-26 spec) ---
		const port = CONFIG.port;
		const resourceUrl = CONFIG.resourceUrl || `http://localhost:${port}`;

		// JWT validator for OAuth
		const jwtValidator = CONFIG.enableOAuth
			? createMCPJWTValidator(resourceUrl)
			: null;

		// Session tracking: sessionId -> { server, transport, principal }
		const sessions = new Map<
			string,
			{
				server: McpServer;
				transport: WebStandardStreamableHTTPServerTransport;
				principal: McpSessionPrincipal;
			}
		>();

		logFunc(
			`Starting BSV MCP Server in Streamable HTTP mode on port ${port}...`,
		);
		if (CONFIG.enableOAuth) {
			logFunc(`OAuth 2.1 authentication enabled`);
			logFunc(`  Issuer: ${CONFIG.oauthIssuer}`);
			logFunc(`  Resource: ${resourceUrl}`);
		}

		const authServer =
			process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com";

		// The modern leg is deliberately strict. Requests without a 2026
		// envelope are routed to the sessionful legacy leg below, preserving the
		// existing 2025 Streamable HTTP behavior and session map.
		const modernHandler = createMcpHandler(
			(requestContext: McpRequestContext) => {
				const configured = createConfiguredServer({
					...serverFactoryOpts,
					era: requestContext.era,
				});
				// Keep the exported reference useful for diagnostics. Request auth is
				// supplied to modernHandler.fetch per request, never stored globally.
				server = configured;
				return configured;
			},
			{
				legacy: "reject",
				responseMode: "auto",
				onerror: (error) => logFunc(`MCP HTTP modern error: ${error}`),
			},
		);

		/** CORS headers for the /mcp endpoint */
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
			"Access-Control-Allow-Headers":
				"Content-Type, Authorization, mcp-session-id, Last-Event-ID, mcp-protocol-version, mcp-method, mcp-name",
			"Access-Control-Expose-Headers":
				"mcp-session-id, mcp-protocol-version, mcp-method, mcp-name",
		} as const;

		/**
		 * Validate OAuth JWT token from request.
		 * Returns null if auth disabled or no token. Throws on invalid token.
		 */
		async function validateAuth(req: Request): Promise<BSVJWTPayload | null> {
			if (!CONFIG.enableOAuth || !jwtValidator) return null;

			const userContext = await jwtValidator.validateFromRequest(req);
			if (!userContext) {
				const err = new Error("Authentication required");
				(err as Error & { status: number }).status = 401;
				throw err;
			}

			logFunc(
				`Authenticated: ${userContext.sub} (pubkey: ${userContext.pubkey?.substring(0, 20)}...)`,
			);
			return userContext;
		}

		Bun.serve({
			hostname: process.env.HOST || "0.0.0.0",
			port,
			async fetch(req: Request): Promise<Response> {
				const url = new URL(req.url);

				// --- CORS preflight ---
				if (req.method === "OPTIONS") {
					return new Response(null, { status: 204, headers: corsHeaders });
				}

				// --- OAuth 2.1 Authorization Server Metadata ---
				if (
					req.method === "GET" &&
					url.pathname === "/.well-known/oauth-authorization-server"
				) {
					return Response.json(
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
						{
							headers: {
								"Access-Control-Allow-Origin": "*",
								"Cache-Control": "public, max-age=3600",
							},
						},
					);
				}

				// --- OAuth 2.1 Protected Resource Metadata (RFC 9728) ---
				if (
					req.method === "GET" &&
					url.pathname === "/.well-known/oauth-protected-resource"
				) {
					return Response.json(
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
						{
							headers: {
								"Access-Control-Allow-Origin": "*",
								"Cache-Control": "public, max-age=3600",
							},
						},
					);
				}

				// --- MCP Streamable HTTP endpoint ---
				if (url.pathname === "/mcp") {
					// Validate OAuth
					let authInfo:
						| { token: string; clientId: string; scopes: string[] }
						| undefined;
					try {
						const userCtx = await validateAuth(req);
						if (userCtx) {
							authInfo = {
								token: req.headers.get("Authorization")?.substring(7) || "",
								clientId: userCtx.sub,
								scopes: userCtx.scope?.split(" ") || [],
							};
						}
					} catch (error) {
						const msg =
							error instanceof Error
								? error.message
								: "Token validation failed";
						return new Response(
							JSON.stringify({ error: "invalid_token", message: msg }),
							{
								status: 401,
								headers: {
									"Content-Type": "application/json",
									"WWW-Authenticate": generateWWWAuthenticate(
										resourceUrl,
										"invalid_token",
										msg,
									),
									...corsHeaders,
								},
							},
						);
					}

					// Modern requests are stateless and do not use MCP-Session-Id.
					// isLegacyRequest reads a clone, so the original body remains
					// available to the selected handler.
					if (!(await isLegacyRequest(req))) {
						const response = await modernHandler.fetch(req, { authInfo });
						for (const [k, v] of Object.entries(corsHeaders)) {
							if (!response.headers.has(k)) response.headers.set(k, v);
						}
						return response;
					}

					// Route to existing session or create new one
					const sessionId = req.headers.get("mcp-session-id");

					if (sessionId) {
						const session = sessions.get(sessionId);
						if (!session) {
							return new Response(
								JSON.stringify({
									jsonrpc: "2.0",
									error: { code: -32001, message: "Session not found" },
									id: null,
								}),
								{
									status: 404,
									headers: {
										"Content-Type": "application/json",
										...corsHeaders,
									},
								},
							);
						}

						if (!isMcpSessionPrincipalMatch(session.principal, authInfo)) {
							return new Response(
								JSON.stringify({
									jsonrpc: "2.0",
									error: {
										code: -32003,
										message: "MCP session is bound to a different principal",
									},
									id: null,
								}),
								{
									status: 403,
									headers: {
										"Content-Type": "application/json",
										...corsHeaders,
									},
								},
							);
						}

						const response = await session.transport.handleRequest(req, {
							authInfo,
						});
						// Add CORS headers to transport response
						for (const [k, v] of Object.entries(corsHeaders)) {
							if (!response.headers.has(k)) response.headers.set(k, v);
						}
						return response;
					}

					// No session ID — new session (initialization request)
					const principal = getMcpSessionPrincipal(authInfo);
					const transport = new WebStandardStreamableHTTPServerTransport({
						sessionIdGenerator: () => crypto.randomUUID(),
						onsessioninitialized: (id: string) => {
							sessions.set(id, {
								server: mcpServer,
								transport,
								principal,
							});
							logFunc(`New MCP session: ${id}`);
						},
						onsessionclosed: (id: string) => {
							sessions.delete(id);
							logFunc(`MCP session closed: ${id}`);
						},
					});

					const mcpServer = createConfiguredServer({
						...serverFactoryOpts,
						era: "legacy",
					});
					await mcpServer.connect(transport);

					const response = await transport.handleRequest(req, { authInfo });
					// Add CORS headers
					for (const [k, v] of Object.entries(corsHeaders)) {
						if (!response.headers.has(k)) response.headers.set(k, v);
					}
					return response;
				}

				return new Response("Not Found", { status: 404 });
			},
			error(error: Error): Response {
				logFunc(`Bun server error: ${error}\n${error.stack}`);
				return new Response("Internal Server Error", { status: 500 });
			},
		});

		logFunc(`Bun server listening on http://localhost:${port}`);
		logFunc("  MCP Endpoint: /mcp (Streamable HTTP)");
		logFunc("  OAuth Discovery: /.well-known/oauth-protected-resource");
	}
}

export { server };
