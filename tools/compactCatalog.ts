import type {
	CallToolResult,
	McpServer,
	ServerContext,
	ToolAnnotations,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { isExternalWalletContext } from "../utils/externalWalletConfig";
import { PEER_PAYMENT_MESSAGEBOX_HOST } from "../utils/peerPaymentReceive";
import { registerBsvTools } from "./bsv";
import { registerStatusTool } from "./bsv/status";
import type { ToolsConfig } from "./index";
import { registerOrdinalsTools } from "./ordinals";
import { registerUtilsTools } from "./utils";
import { registerTool, type ToolResponse } from "./utils/toolRegistration";
import {
	executeWalletOnboarding,
	isWalletOnboardingAvailable,
	WALLET_ONBOARDING_ANNOTATIONS,
	WALLET_ONBOARDING_TOOL_NAME,
	walletOnboardingInputSchema,
} from "./wallet/onboarding";
import { registerPeerPaymentsTool } from "./wallet/peerPayments";
import { registerWalletTools } from "./wallet/tools";

/** The server-selected tool catalog. The default is deliberately full. */
export type ToolCatalogProfile = "full" | "compact";

export type Availability = {
	available: boolean;
	reason?: string;
};

export type CatalogContext = {
	config: ToolsConfig;
};

export type CompactOperation = {
	id: string;
	schema: z.ZodTypeAny;
	handler: (args: unknown, ctx: ServerContext) => Promise<ToolResponse>;
	annotations: ToolAnnotations;
	availability?: (ctx: CatalogContext) => Availability;
};

export type CompactFamily = {
	name: string;
	description: string;
	operations: ReadonlyMap<string, CompactOperation>;
	annotations: ToolAnnotations;
};

/**
 * The compatibility map is kept in one place so manifest and equivalence
 * tests can prove that every compact operation has one legacy implementation.
 * The wallet entries that require BRC-100 are filtered at registration time.
 */
export const COMPACT_OPERATION_LEGACY_NAMES = {
	bsv_read: [
		"bsv_getPrice",
		"bsv_decodeTransaction",
		"bsv_explore",
		"bsv_status",
	],
	ordinals_read: [
		"ordinals_getInscription",
		"ordinals_searchInscriptions",
		"ordinals_marketListings",
		"ordinals_marketSales",
		"ordinals_getTokenByIdOrTicker",
	],
	wallet_read: [
		"wallet_getAddress",
		"wallet_getBalance",
		"wallet_getOrdinals",
		"wallet_listTokens",
		"wallet_getBsv21Balances",
		"wallet_getLockData",
		"wallet_getHeight",
		"wallet_getHeaderForHeight",
		"wallet_getNetwork",
		"wallet_getVersion",
		"wallet_getPublicKey",
		"wallet_isAuthenticated",
		"wallet_waitForAuthentication",
	],
	utility: ["utils_convertData", "utils_find_skills"],
	wallet_setup: ["wallet_onboarding"],
	// PeerPay receive stays out of the read-only wallet_read family: its
	// receive operation internalizes funds and acknowledges the MessageBox
	// item, so it ships as a dedicated mutating payments capability.
	wallet_payments: ["wallet_peerPayments"],
} as const;

export type CompactFamilyName = keyof typeof COMPACT_OPERATION_LEGACY_NAMES;

export type CompactCapability = {
	family: CompactFamilyName;
	operation: string;
	legacyName: string;
	registered: boolean;
	reason?: string;
};

const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
	readOnlyHint: true,
	idempotentHint: true,
	destructiveHint: false,
	openWorldHint: true,
};

// PeerPay receive can mutate: the receive operation internalizes funds into
// the embedded wallet and acknowledges the MessageBox item.
const PEER_PAYMENTS_ANNOTATIONS: ToolAnnotations = {
	readOnlyHint: false,
	destructiveHint: true,
	idempotentHint: false,
	openWorldHint: true,
};

const PEER_PAYMENTS_LEGACY_NAME = "wallet_peerPayments";

const CORE_WALLET_READS = [
	"wallet_getAddress",
	"wallet_getBalance",
	"wallet_getOrdinals",
	"wallet_listTokens",
	"wallet_getBsv21Balances",
	"wallet_getLockData",
] as const;

const PAYMENTS_WALLET_READS = [
	"wallet_getAddress",
	"wallet_getBalance",
] as const;

const BRC100_WALLET_READS = [
	"wallet_getHeight",
	"wallet_getHeaderForHeight",
	"wallet_getNetwork",
	"wallet_getVersion",
	"wallet_getPublicKey",
	"wallet_isAuthenticated",
	"wallet_waitForAuthentication",
] as const;

const BSV_READS = COMPACT_OPERATION_LEGACY_NAMES.bsv_read;
const ORDINALS_READS = COMPACT_OPERATION_LEGACY_NAMES.ordinals_read;

type CapturedTool = {
	name: string;
	description: string;
	schema: z.ZodTypeAny;
	annotations?: ToolAnnotations;
	handler: (args: unknown, ctx: ServerContext) => Promise<CallToolResult>;
};

/**
 * Existing registrars contain the canonical callback and schema. Capture them
 * on a registration-only facade so compact mode can adapt the exact callback
 * without a second business implementation or a second public alias.
 */
function captureRegistrations(register: (server: McpServer) => void) {
	const captured = new Map<string, CapturedTool>();
	const registrationFacade = {
		registerTool(
			name: string,
			options: {
				description?: string;
				inputSchema?: z.ZodTypeAny;
				annotations?: ToolAnnotations;
			},
			handler: (args: unknown, ctx: ServerContext) => Promise<CallToolResult>,
		) {
			const schema = options.inputSchema;
			if (!schema) throw new Error(`Missing schema for ${name}`);
			captured.set(name, {
				name,
				description: options.description ?? name,
				schema,
				annotations: options.annotations,
				handler,
			});
		},
	} as unknown as McpServer;

	register(registrationFacade);
	return captured;
}

function operationFromCapture(
	captured: CapturedTool,
	availability?: CompactOperation["availability"],
): CompactOperation {
	return {
		id: captured.name,
		schema: captured.schema,
		handler: async (args, ctx) => captured.handler(args, ctx),
		annotations: { ...READ_ONLY_ANNOTATIONS, ...captured.annotations },
		availability,
	};
}

function operationsFromCaptures(
	captured: Map<string, CapturedTool>,
	legacyNames: readonly string[],
	availability?: CompactOperation["availability"],
) {
	const operations = new Map<string, CompactOperation>();
	for (const legacyName of legacyNames) {
		const registration = captured.get(legacyName);
		if (!registration) continue;
		operations.set(
			legacyName,
			operationFromCapture(registration, availability),
		);
	}
	return operations;
}

function readOnlyFamily(
	name: CompactFamilyName,
	description: string,
	operations: Map<string, CompactOperation>,
): CompactFamily {
	return {
		name,
		description,
		operations,
		annotations: READ_ONLY_ANNOTATIONS,
	};
}

function isEnabled(
	value: boolean | undefined,
	environmentName: string,
	defaultValue = true,
): boolean {
	if (value === false) return false;
	return process.env[environmentName] !== "true" && (value ?? defaultValue);
}

function categoryEnabled(
	config: ToolsConfig,
	category: CompactFamilyName,
): boolean {
	switch (category) {
		case "bsv_read":
			return isEnabled(config.enableBsvTools, "DISABLE_BSV_TOOLS");
		case "ordinals_read":
			return isEnabled(config.enableOrdinalsTools, "DISABLE_ORDINALS_TOOLS");
		case "utility":
			return isEnabled(config.enableUtilsTools, "DISABLE_UTILS_TOOLS");
		case "wallet_read":
			return isEnabled(config.enableWalletTools, "DISABLE_WALLET_TOOLS");
		case "wallet_payments":
			return isEnabled(config.enableWalletTools, "DISABLE_WALLET_TOOLS");
		case "wallet_setup":
			// Availability is controlled only by the caller-provided
			// walletSetupNeeded/openWalletSetup pair, not by category flags.
			return true;
	}
}

function captureConfig(config: ToolsConfig) {
	const externalWallet =
		config.externalWallet ??
		(isExternalWalletContext(config.ctx) || config.ctx?.isBaseWallet === false);
	const bsv = categoryEnabled(config, "bsv_read")
		? captureRegistrations((server) => {
				registerBsvTools(server);
				registerStatusTool(server, config);
			})
		: new Map<string, CapturedTool>();
	const ordinals = categoryEnabled(config, "ordinals_read")
		? captureRegistrations((server) => {
				registerOrdinalsTools(server, config.ctx?.services ?? config.services);
			})
		: new Map<string, CapturedTool>();
	const utility = categoryEnabled(config, "utility")
		? captureRegistrations((server) => registerUtilsTools(server))
		: new Map<string, CapturedTool>();
	const wallet =
		categoryEnabled(config, "wallet_read") &&
		!config.integratedWallet?.isDroplitMode &&
		(config.wallet || config.ctx)
			? captureRegistrations((server) =>
					registerWalletTools(server, config.wallet, {
						ctx: config.ctx,
						roleContexts: config.roleContexts,
						allowWholeWalletBalance: !externalWallet,
						scope: config.walletScope,
					}),
				)
			: new Map<string, CapturedTool>();
	const peerPaymentsCtx = config.ctx;
	const peerPayments =
		categoryEnabled(config, "wallet_payments") &&
		peerPaymentsCtx &&
		!externalWallet &&
		!config.integratedWallet?.isDroplitMode &&
		config.walletScope !== "payments"
			? captureRegistrations((server) =>
					registerPeerPaymentsTool(
						server,
						peerPaymentsCtx,
						PEER_PAYMENT_MESSAGEBOX_HOST,
						externalWallet,
					),
				)
			: new Map<string, CapturedTool>();
	return { bsv, ordinals, utility, wallet, peerPayments };
}

function walletAvailability({ config }: CatalogContext): Availability {
	return config.ctx
		? { available: true }
		: {
				available: false,
				reason: "BRC-100 wallet context not available",
			};
}

function peerPaymentsAvailability({ config }: CatalogContext): Availability {
	if (!config.ctx) {
		return {
			available: false,
			reason: "BRC-100 wallet context not available",
		};
	}
	const externalWallet =
		config.externalWallet ??
		(isExternalWalletContext(config.ctx) || config.ctx?.isBaseWallet === false);
	if (externalWallet) {
		return {
			available: false,
			reason: "PeerPay receive is unavailable in external signer mode",
		};
	}
	if (config.integratedWallet?.isDroplitMode) {
		return {
			available: false,
			reason: "PeerPay receive is unavailable in Droplit mode",
		};
	}
	if (config.walletScope === "payments") {
		return {
			available: false,
			reason: "PeerPay receive is unavailable in project payments scope",
		};
	}
	return { available: true };
}

/**
 * The onboarding setup action is mutating, so it must not live in a
 * read-only family. It gets a dedicated family with truthful mutating
 * annotations. Availability comes only from the caller-provided
 * walletSetupNeeded/openWalletSetup pair.
 */
function buildWalletSetupFamily(config: ToolsConfig): CompactFamily | null {
	if (!isWalletOnboardingAvailable(config) || !config.openWalletSetup)
		return null;
	const openWalletSetup = config.openWalletSetup;
	const operations = new Map<string, CompactOperation>([
		[
			WALLET_ONBOARDING_TOOL_NAME,
			{
				id: WALLET_ONBOARDING_TOOL_NAME,
				schema: walletOnboardingInputSchema,
				handler: () => executeWalletOnboarding(openWalletSetup),
				annotations: { ...WALLET_ONBOARDING_ANNOTATIONS },
			},
		],
	]);
	return {
		name: "wallet_setup",
		description:
			"Wallet setup operation. Select operation and pass that operation's arguments in args.",
		operations,
		annotations: { ...WALLET_ONBOARDING_ANNOTATIONS },
	};
}

/**
 * Build compact families in the same dependency order as registerAllTools.
 * Category gates are evaluated before capture, so disabled categories never
 * run their registrars and never advertise a family.
 */
export function buildCompactFamilies(config: ToolsConfig): CompactFamily[] {
	const families: CompactFamily[] = [];
	const captured = captureConfig(config);

	if (categoryEnabled(config, "bsv_read")) {
		families.push(
			readOnlyFamily(
				"bsv_read",
				"Read-only BSV operations. Select operation and pass that operation's arguments in args.",
				operationsFromCaptures(captured.bsv, BSV_READS),
			),
		);
	}

	if (categoryEnabled(config, "ordinals_read")) {
		families.push(
			readOnlyFamily(
				"ordinals_read",
				"Read-only Ordinals and marketplace operations. Select operation and pass that operation's arguments in args.",
				operationsFromCaptures(captured.ordinals, ORDINALS_READS),
			),
		);
	}

	if (
		categoryEnabled(config, "wallet_read") &&
		!config.integratedWallet?.isDroplitMode &&
		(config.wallet || config.ctx)
	) {
		const operations = operationsFromCaptures(
			captured.wallet,
			config.walletScope === "payments"
				? PAYMENTS_WALLET_READS
				: CORE_WALLET_READS,
			walletAvailability,
		);
		// BRC-100 registrations are present only when the same context is
		// available to the concrete registrar. The six action-backed reads stay
		// visible with a configured wallet and report call-time unavailability.
		if (config.ctx && config.walletScope !== "payments") {
			for (const operation of operationsFromCaptures(
				captured.wallet,
				BRC100_WALLET_READS,
				walletAvailability,
			)) {
				operations.set(operation[0], operation[1]);
			}
		}
		families.push(
			readOnlyFamily(
				"wallet_read",
				"Read-only wallet operations. Select operation and pass that operation's arguments in args.",
				operations,
			),
		);
	}

	if (categoryEnabled(config, "utility")) {
		families.push(
			readOnlyFamily(
				"utility",
				"Read-only data conversion and skill discovery operations. Select operation and pass that operation's arguments in args.",
				operationsFromCaptures(captured.utility, [
					"utils_convertData",
					"utils_find_skills",
				]),
			),
		);
	}

	const walletSetupFamily = buildWalletSetupFamily(config);
	if (walletSetupFamily) families.push(walletSetupFamily);

	// Dedicated PeerPay payments capability. It stays out of wallet_read so
	// the read-only family keeps its guarantees, and it carries mutating
	// annotations because the receive operation internalizes funds.
	if (categoryEnabled(config, "wallet_payments")) {
		const registration = captured.peerPayments.get(PEER_PAYMENTS_LEGACY_NAME);
		if (registration) {
			const operations = new Map<string, CompactOperation>([
				[
					registration.name,
					{
						id: registration.name,
						schema: registration.schema,
						handler: async (args, ctx) => registration.handler(args, ctx),
						annotations: { ...PEER_PAYMENTS_ANNOTATIONS },
						availability: peerPaymentsAvailability,
					},
				],
			]);
			families.push({
				name: "wallet_payments",
				description:
					"PeerPay payment operations. Select operation and pass that operation's arguments in args. Receiving internalizes funds into the embedded wallet and acknowledges the MessageBox item.",
				operations,
				annotations: PEER_PAYMENTS_ANNOTATIONS,
			});
		}
	}

	return families.filter((family) => family.operations.size > 0);
}

function familySchema(operations: ReadonlyMap<string, CompactOperation>) {
	const ids = [...operations.keys()];
	if (ids.length === 0)
		throw new Error("Cannot register an empty compact family");
	return z.object({
		// Keep the wire schema's bounded enum while allowing the callback to
		// return the stable COMPACT_UNKNOWN_OPERATION code for a hand-written
		// request that names an unknown string.
		operation: z.string().meta({ enum: ids }),
		args: z.record(z.string(), z.unknown()).default({}),
	});
}

/** Register one compact family using the shared error wrapper. */
function registerCompactFamily(
	server: McpServer,
	family: CompactFamily,
	context: CatalogContext,
): void {
	const schema = familySchema(family.operations);
	registerTool(server, {
		name: family.name,
		description: family.description,
		schema,
		annotations: family.annotations,
		handler: async (input, serverContext) => {
			const parsed = schema.safeParse(input);
			if (!parsed.success) {
				throw new Error(
					`COMPACT_INVALID_ARGS: ${parsed.error.issues
						.map((issue) => issue.message)
						.join("; ")}`,
				);
			}

			const operation = family.operations.get(parsed.data.operation);
			if (!operation) {
				throw new Error(`COMPACT_UNKNOWN_OPERATION: ${parsed.data.operation}`);
			}

			const availability = operation.availability?.(context);
			if (availability && !availability.available) {
				throw new Error(
					`COMPACT_UNAVAILABLE: ${availability.reason ?? "operation is unavailable"}`,
				);
			}

			const operationArgs = operation.schema.safeParse(parsed.data.args);
			if (!operationArgs.success) {
				throw new Error(
					`COMPACT_INVALID_ARGS: ${operationArgs.error.issues
						.map((issue) => issue.message)
						.join("; ")}`,
				);
			}
			return operation.handler(operationArgs.data, serverContext);
		},
	});
}

export function registerCompactCatalog(
	server: McpServer,
	config: ToolsConfig = {},
): void {
	const context: CatalogContext = { config };
	for (const family of buildCompactFamilies(config))
		registerCompactFamily(server, family, context);
}

/** Resolve once from explicit server configuration; request data is ignored. */
export function resolveToolCatalogProfile(
	config: Pick<ToolsConfig, "toolCatalog"> = {},
): ToolCatalogProfile {
	return config.toolCatalog === "compact" ? "compact" : "full";
}

/**
 * Resolve the process-level server setting. An omitted value keeps the
 * backward-compatible full catalog; a typo fails startup instead of silently
 * selecting a different catalog.
 */
export function resolveToolCatalogFromEnvironment(
	value = process.env.MCP_TOOL_CATALOG,
): ToolCatalogProfile {
	if (value === undefined) return "full";
	if (value === "full" || value === "compact") return value;
	throw new Error(
		`MCP_TOOL_CATALOG must be "full" or "compact"; received "${value}"`,
	);
}

export function getCompactCapabilityMetadata(
	config: ToolsConfig = {},
): CompactCapability[] {
	const registered = new Set(
		buildCompactFamilies(config).flatMap((family) => [
			...family.operations.keys(),
		]),
	);
	return (
		Object.entries(COMPACT_OPERATION_LEGACY_NAMES) as [
			CompactFamilyName,
			readonly string[],
		][]
	).flatMap(([family, legacyNames]) =>
		legacyNames.map((legacyName) => ({
			family,
			operation: legacyName,
			legacyName,
			registered: registered.has(legacyName),
			...(family === "wallet_read" && !registered.has(legacyName)
				? { reason: walletCapabilityReason(config, legacyName) }
				: {}),
			...(family === "wallet_setup" && !registered.has(legacyName)
				? { reason: walletSetupCapabilityReason(config) }
				: {}),
		})),
	);
}

function walletSetupCapabilityReason(config: ToolsConfig): string {
	if (config.walletSetupNeeded !== true) return "wallet setup is not needed";
	if (typeof config.openWalletSetup !== "function")
		return "wallet setup opener is not configured";
	return "operation is unavailable";
}

function walletCapabilityReason(
	config: ToolsConfig,
	operation: string,
): string {
	const externalWallet =
		config.externalWallet ??
		(isExternalWalletContext(config.ctx) || config.ctx?.isBaseWallet === false);
	if (!categoryEnabled(config, "wallet_read"))
		return "wallet category is disabled";
	if (config.integratedWallet?.isDroplitMode)
		return "normal wallet reads are unavailable in Droplit mode";
	if (externalWallet && operation === "wallet_getBalance")
		return "whole-wallet balance is unavailable in external signer mode";
	if (!config.wallet && !config.ctx) return "wallet is not configured";
	if (
		BRC100_WALLET_READS.includes(
			operation as (typeof BRC100_WALLET_READS)[number],
		) &&
		!config.ctx
	)
		return "BRC-100 wallet context not available";
	return "operation is unavailable";
}
