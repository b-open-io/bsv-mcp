/**
 * The roles a project may assign to a Vault entry. Keep this list in sync with
 * projectRoleBindings.ts, but do not import a wallet or a Vault here. Routing
 * is deliberately pure so it can run before any secret is unlocked.
 */
export const PROJECT_TOOL_ROLES = [
	"identity-signing",
	"encryption",
	"payments",
	"one-sat",
] as const;

/**
 * Baskets owned by the 1Sat asset module. Keep this set exact. Treating an
 * arbitrary basket name as a payment basket would let a project selected for
 * ordinary BSV spend an asset held by a different permission module.
 */
export const PROJECT_TOOL_ASSET_BASKETS = Object.freeze([
	"1sat",
	"bsv21",
	"opns",
	"lock",
	"sigma",
	"bsocial",
	"bap",
] as const);

const projectToolAssetBaskets = new Set<string>(PROJECT_TOOL_ASSET_BASKETS);

export type ProjectToolRole = (typeof PROJECT_TOOL_ROLES)[number];
export type ProjectToolContextGroup =
	| ProjectToolRole
	| "public"
	| "wallet"
	| "account"
	| "droplit";

export type ProjectToolAccountConstraint = "none" | "same-account";
export type ProjectToolVaultSupport =
	| "supported"
	| "conditional"
	| "unsupported"
	| "public";

export interface ProjectToolPolicy {
	readonly toolName: string;
	readonly requiredRoles: readonly ProjectToolRole[];
	readonly requiredContextGroups: readonly ProjectToolContextGroup[];
	readonly accountConstraint: ProjectToolAccountConstraint;
	readonly feeRole?: "payments";
	readonly vaultSupport: ProjectToolVaultSupport;
	readonly unsupportedReason?: string;
}

export class ProjectToolRoleError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(`${code}: ${message}`);
		this.name = "ProjectToolRoleError";
		this.code = code;
	}
}

function fail(code: string, message: string): never {
	throw new ProjectToolRoleError(code, message);
}

const freeze = <T>(value: T): Readonly<T> => {
	if (value !== null && typeof value === "object") {
		for (const child of Object.values(value)) freeze(child);
		Object.freeze(value);
	}
	return value as Readonly<T>;
};

function policy(
	toolName: string,
	roles: readonly ProjectToolRole[],
	options: Partial<
		Pick<
			ProjectToolPolicy,
			| "requiredContextGroups"
			| "accountConstraint"
			| "feeRole"
			| "vaultSupport"
			| "unsupportedReason"
		>
	> = {},
): ProjectToolPolicy {
	const requiredRoles = [...roles];
	return freeze({
		toolName,
		requiredRoles,
		requiredContextGroups: options.requiredContextGroups ?? requiredRoles,
		accountConstraint:
			options.accountConstraint ??
			(requiredRoles.length > 1 ? "same-account" : "none"),
		...(options.feeRole === undefined ? {} : { feeRole: options.feeRole }),
		vaultSupport: options.vaultSupport ?? "supported",
		...(options.unsupportedReason === undefined
			? {}
			: { unsupportedReason: options.unsupportedReason }),
	});
}

const publicPolicy = (toolName: string) =>
	policy(toolName, [], {
		requiredContextGroups: ["public"],
		vaultSupport: "public",
	});

const walletContextPolicy = (
	toolName: string,
	vaultSupport: ProjectToolVaultSupport = "supported",
) =>
	policy(toolName, [], {
		requiredContextGroups: ["wallet"],
		vaultSupport,
	});

const accountContextPolicy = (toolName: string) =>
	policy(toolName, [], {
		requiredContextGroups: ["account"],
		vaultSupport: "unsupported",
		unsupportedReason:
			"Account administration is handled by the local account controller.",
	});

const droplitContextPolicy = (
	toolName: string,
	vaultSupport: ProjectToolVaultSupport = "unsupported",
) =>
	policy(toolName, [], {
		requiredContextGroups: ["droplit"],
		vaultSupport,
	});

const TOOL_POLICIES: Record<string, ProjectToolPolicy> = {};
const add = (value: ProjectToolPolicy) => {
	TOOL_POLICIES[value.toolName] = value;
};

// Public BSV, Ordinals, BMAP and utility reads do not select a project key.
for (const name of [
	"bsv_getPrice",
	"bsv_decodeTransaction",
	"bsv_explore",
	"bsv_status",
	"ordinals_getInscription",
	"ordinals_searchInscriptions",
	"ordinals_marketListings",
	"ordinals_marketSales",
	"ordinals_getTokenByIdOrTicker",
	"bsocial_readPosts",
	"bmap_readPosts",
	"bmap_readLikes",
	"bmap_readFollows",
	"utils_convertData",
	"x402_request",
	"mnee_parseTx",
	"droplit_discover",
	"bsv_read",
	"ordinals_read",
	"utility",
] as const) {
	add(publicPolicy(name));
}

// The dashboard and its explorer, marketplace and source-address scan tools
// only read public services. They do not select a wallet key.
for (const name of [
	"bsv_dashboard",
	"app_explorer_data",
	"app_ordinals_data",
	"app_sweep_scan",
] as const) {
	add(publicPolicy(name));
}

// Sweep preparation selects roles from the requested asset type. Completion
// receives only an opaque reference, so keep its wallet context explicit while
// refusing Vault dispatch until that reference is trusted and role-bound.
add(
	policy("app_sweep_prepare", [], {
		requiredContextGroups: ["wallet"],
		vaultSupport: "conditional",
	}),
);
add(
	policy("app_sweep_complete", [], {
		requiredContextGroups: ["wallet"],
		vaultSupport: "unsupported",
		unsupportedReason:
			"Sweep completion is unavailable in Vault mode until its opaque reference is bound to a trusted sweep role.",
	}),
);

// BRC-100 chain and version information is wallet RPC context, but it does
// not select a project key role.
for (const name of [
	"wallet_getHeight",
	"wallet_getHeaderForHeight",
	"wallet_getNetwork",
	"wallet_getVersion",
] as const) {
	add(walletContextPolicy(name));
}

for (const name of [
	"wallet_isAuthenticated",
	"wallet_waitForAuthentication",
] as const)
	add(walletContextPolicy(name));

// Conditional entries remain in the exported allowlist so callers can audit
// every registered name without treating an unresolved route as a payment.
for (const name of [
	"wallet_getPublicKey",
	"wallet_listOutputs",
	"wallet_relinquishOutput",
] as const)
	add(
		policy(name, [], {
			requiredContextGroups: ["wallet"],
			vaultSupport: "conditional",
		}),
	);

// Named account management is intentionally outside Vault role routing.
for (const name of [
	"wallet_list",
	"wallet_generate",
	"wallet_import",
	"wallet_use",
	"wallet_remove",
] as const)
	add(accountContextPolicy(name));

// Ordinary payment wallet operations.
for (const name of [
	"wallet_getBalance",
	"wallet_sendBsv",
	"wallet_sendAllBsv",
	"wallet_createAction",
	"wallet_signAction",
	"wallet_abortAction",
	"wallet_internalizeAction",
	"wallet_listActions",
	"x402_payQuote",
] as const)
	add(policy(name, ["payments"], { feeRole: "payments" }));

// Address derivation uses the identity key as the sender identity and the
// P1SAT/One Sat derivation for the deposit key. Refresh additionally rotates
// plain-BSV deposits into the funding basket, which needs fee inputs.
add(policy("wallet_getAddress", ["identity-signing", "one-sat"]));
add(
	policy("wallet_refreshUtxos", ["identity-signing", "one-sat", "payments"], {
		feeRole: "payments",
	}),
);

add(policy("wallet_getLockData", ["one-sat"]));

// Locking and unlocking are asset operations. Both read/write the lock basket
// and create an action whose fee must come from the payment context.
for (const name of ["wallet_lockBsv", "wallet_unlockBsv"] as const)
	add(policy(name, ["one-sat", "payments"], { feeRole: "payments" }));

// The app wallet panel combines the P1SAT deposit address with the default
// payment-basket balance, so it needs all contexts used by those reads.
add(
	policy("app_wallet_data", ["identity-signing", "one-sat", "payments"], {
		feeRole: "payments",
	}),
);

// MNEE currently reads PRIVATE_KEY_WIF directly and cannot be bound to a
// project Vault entry. Keep the payment requirement visible while rejecting
// it from Vault mode rather than silently using a process-global key.
for (const name of ["mnee_getBalance", "mnee_sendMnee"] as const)
	add(
		policy(name, ["payments"], {
			feeRole: "payments",
			vaultSupport: "unsupported",
			unsupportedReason:
				"MNEE tools use the legacy process key and are unavailable in Vault mode.",
		}),
	);

// One Sat reads and asset ownership operations are separate from ordinary
// BSV payments. Asset transactions also need a payment context for mining
// fees, and this implementation only supports both contexts from one account.
for (const name of [
	"wallet_getOrdinals",
	"wallet_listTokens",
	"wallet_getBsv21Balances",
] as const)
	add(policy(name, ["one-sat"]));

for (const name of [
	"wallet_transferOrdToken",
	"wallet_listOrdinal",
	"wallet_cancelListing",
	"wallet_purchaseListing",
	"wallet_sweepOrdinals",
	"wallet_sweepBsv21",
	"wallet_opnsRegister",
	"wallet_opnsDeregister",
	"wallet_createOrdinals",
] as const)
	add(policy(name, ["one-sat", "payments"], { feeRole: "payments" }));

// These sweep tools accept a raw external WIF. They cannot be bound to the
// selected project's Vault account until an explicit external-key adapter is
// implemented, but retain their spend and fee roles for callers that inspect
// the route before the support check.
add(
	policy("wallet_sweepBsv", ["payments"], {
		feeRole: "payments",
		vaultSupport: "unsupported",
		unsupportedReason:
			"Raw-WIF BSV sweeps are unavailable in Vault mode until an external-key adapter is supported.",
	}),
);
for (const name of ["wallet_sweepOrdinals", "wallet_sweepBsv21"] as const)
	add(
		policy(name, ["one-sat", "payments"], {
			feeRole: "payments",
			vaultSupport: "unsupported",
			unsupportedReason:
				"Raw-WIF asset sweeps are unavailable in Vault mode until an external-key adapter is supported.",
		}),
	);

// These older collection handlers use the local Wallet class and cannot be
// safely attached to a Vault WalletInterface without an explicit adapter.
for (const name of [
	"wallet_gatherCollectionInfo",
	"wallet_mintCollection",
] as const)
	add(
		policy(name, ["one-sat", "payments"], {
			feeRole: "payments",
			vaultSupport: "unsupported",
			unsupportedReason:
				"Collection tools require the explicitly supported One Sat adapter.",
		}),
	);

// Identity and cryptographic operations must use the identity or encryption
// role selected by the project. They never fall back to the payment role.
for (const name of [
	"bap_getCurrentAddress",
	"wallet_signBsm",
	"wallet_createSignature",
	"wallet_verifySignature",
	"wallet_revealCounterpartyKeyLinkage",
	"wallet_revealSpecificKeyLinkage",
	"wallet_acquireCertificate",
	"wallet_listCertificates",
	"wallet_proveCertificate",
	"wallet_relinquishCertificate",
	"wallet_discoverByIdentityKey",
	"wallet_discoverByAttributes",
	"wallet_revealDelegation",
] as const)
	add(policy(name, ["identity-signing"]));

for (const name of [
	"wallet_encrypt",
	"wallet_decrypt",
	"wallet_createHmac",
	"wallet_verifyHmac",
] as const)
	add(policy(name, ["encryption"]));

// These tools still use the legacy key layout or local Wallet implementation.
// Keeping them in the map makes the rejection explicit to the Vault runtime.
add(
	policy("bap_generate", ["identity-signing", "payments"], {
		feeRole: "payments",
		vaultSupport: "unsupported",
		unsupportedReason:
			"BAP generation requires the local encrypted account and an HD master key.",
	}),
);
add(
	policy("bap_friend", ["identity-signing", "payments"], {
		feeRole: "payments",
		vaultSupport: "unsupported",
		unsupportedReason:
			"BAP friend requests require an HD master key and the legacy Wallet adapter.",
	}),
);
add(
	policy("bsocial_createPost", ["payments"], {
		feeRole: "payments",
		vaultSupport: "unsupported",
		unsupportedReason:
			"The legacy social writer signs and funds with its process-local payment key.",
	}),
);

// Public BAP lookup only uses a project identity when no lookup key is given.
add(publicPolicy("bap_getId"));

// Droplit setup and sponsored transaction tools have their own connected
// service context. They do not select a local project Vault key.
for (const name of [
	"wallet_registerDroplitKey",
	"wallet_createDroplitFaucet",
	"wallet_checkDroplitFaucetStatus",
	"droplit_getAccess",
	"droplit_push",
	"droplit_fund",
] as const)
	add(droplitContextPolicy(name));

add(accountContextPolicy("utils_installAgentMaster"));

export const PROJECT_TOOL_POLICIES: Readonly<
	Record<string, ProjectToolPolicy>
> = freeze(TOOL_POLICIES);

function objectArgs(value: unknown): Record<string, unknown> {
	if (value === undefined) return {};
	if (value === null || typeof value !== "object" || Array.isArray(value))
		fail("PROJECT_TOOL_ARGUMENTS_INVALID", "Tool arguments must be an object");
	return value as Record<string, unknown>;
}

function parseJsonArgument(value: unknown, name: string): unknown {
	if (typeof value !== "string")
		fail("PROJECT_TOOL_ARGUMENTS_INVALID", `${name} must be JSON text`);
	try {
		return JSON.parse(value);
	} catch {
		fail("PROJECT_TOOL_ARGUMENTS_INVALID", `${name} must contain valid JSON`);
	}
}

function parseJsonArray(value: unknown, name: string): readonly unknown[] {
	const parsed = parseJsonArgument(value, name);
	if (!Array.isArray(parsed))
		fail("PROJECT_TOOL_ARGUMENTS_INVALID", `${name} must contain an array`);
	return parsed;
}

function parseLabelsJSON(
	value: unknown,
	name = "labelsJSON",
): readonly string[] {
	if (value === undefined) return [];
	const labels = parseJsonArray(value, name);
	if (!labels.every((label) => typeof label === "string"))
		fail(
			"PROJECT_TOOL_ARGUMENTS_INVALID",
			`${name} must contain only label strings`,
		);
	return labels as readonly string[];
}

function rolePolicy(
	toolName: string,
	roles: readonly ProjectToolRole[],
	options: Partial<
		Pick<ProjectToolPolicy, "vaultSupport" | "unsupportedReason">
	> = {},
) {
	return policy(toolName, roles, {
		...options,
		...(roles.includes("payments") ? { feeRole: "payments" as const } : {}),
	});
}

function assetBasket(value: unknown): boolean {
	return typeof value === "string" && projectToolAssetBaskets.has(value);
}

function assetLabel(value: string): boolean {
	// Permission dispatch labels are `p <scheme> ...`. The seven schemes below
	// are the complete asset set; a plain BSV label is not a dispatch label.
	const match = /^p\s+([^\s]+)(?:\s|$)/.exec(value);
	return match !== null && projectToolAssetBaskets.has(match[1] ?? "");
}

function unknownPermissionLabel(value: string): boolean {
	return /^p\s+[^\s]+(?:\s|$)/.test(value) && !assetLabel(value);
}

function classifyLabels(labels: readonly string[]): {
	hasAsset: boolean;
	hasUnknown: boolean;
} {
	let hasAsset = false;
	let hasUnknown = false;
	for (const label of labels) {
		if (assetLabel(label)) hasAsset = true;
		else if (unknownPermissionLabel(label)) hasUnknown = true;
	}
	return { hasAsset, hasUnknown };
}

function classifyBasket(
	value: unknown,
): "payments" | "asset" | "unknown" | "none" {
	if (value === undefined) return "none";
	if (typeof value !== "string") return "unknown";
	if (value === "default") return "payments";
	if (assetBasket(value)) return "asset";
	return "unknown";
}

function rolesForBasket(toolName: string, value: unknown): ProjectToolPolicy {
	const kind = classifyBasket(value);
	if (kind === "unknown")
		fail(
			"PROJECT_TOOL_ROLE_AMBIGUOUS",
			`${toolName} cannot route unknown basket ownership; use the default basket or a known 1Sat asset basket`,
		);
	if (kind === "asset") return rolePolicy(toolName, ["one-sat"]);
	return rolePolicy(toolName, ["payments"]);
}

function outputBaskets(
	outputs: readonly unknown[],
	name: string,
): readonly unknown[] {
	const baskets: unknown[] = [];
	const pushBasket = (value: unknown) => {
		// `undefined` is reserved for an output with no basket metadata. Once an
		// output declares a basket field, a missing value is malformed and must
		// not fall through to the payment route.
		baskets.push(value === undefined ? null : value);
	};
	for (const output of outputs) {
		if (output === null || typeof output !== "object" || Array.isArray(output))
			fail(
				"PROJECT_TOOL_ARGUMENTS_INVALID",
				`${name} must contain output objects`,
			);
		const record = output as Record<string, unknown>;
		if ("basket" in record) {
			pushBasket(record.basket);
			continue;
		}
		const insertion = record.insertionRemittance;
		if (
			insertion !== null &&
			typeof insertion === "object" &&
			!Array.isArray(insertion) &&
			"basket" in insertion
		) {
			pushBasket((insertion as Record<string, unknown>).basket);
			continue;
		}
		// A BRC-100 payment output is identified by its protocol and has no
		// basket field. An insertion without a basket cannot be safely routed.
		if (record.protocol === "wallet payment") pushBasket("default");
		else if (record.protocol === "basket insertion") pushBasket(null);
	}
	return baskets;
}

function actionPolicy(
	toolName: string,
	outputsJSON: unknown,
	labelsJSON: unknown,
	options: { requireOutputs?: boolean } = {},
): ProjectToolPolicy {
	let outputs: readonly unknown[] = [];
	if (outputsJSON !== undefined || options.requireOutputs) {
		if (outputsJSON === undefined)
			fail(
				"PROJECT_TOOL_ARGUMENTS_INVALID",
				`${toolName} requires outputsJSON`,
			);
		outputs = parseJsonArray(outputsJSON, "outputsJSON");
	}
	const labels = parseLabelsJSON(labelsJSON);
	const labelKinds = classifyLabels(labels);
	if (labelKinds.hasUnknown)
		fail(
			"PROJECT_TOOL_ROLE_AMBIGUOUS",
			`${toolName} contains an unknown permission dispatch label`,
		);
	const baskets = outputBaskets(outputs, "outputsJSON");
	let hasAsset = labelKinds.hasAsset;
	let hasPayments = false;
	for (const basket of baskets) {
		const kind = classifyBasket(basket);
		if (kind === "unknown")
			fail(
				"PROJECT_TOOL_ROLE_AMBIGUOUS",
				`${toolName} cannot route unknown basket ownership; use the default basket or a known 1Sat asset basket`,
			);
		if (kind === "asset") hasAsset = true;
		if (kind === "payments") hasPayments = true;
	}
	// A create/internalize operation with no explicit basket is a regular BSV
	// action unless a known asset dispatch label selected the asset module.
	if (hasAsset && (toolName === "wallet_createAction" || hasPayments))
		return rolePolicy(toolName, ["one-sat", "payments"]);
	if (hasAsset) return rolePolicy(toolName, ["one-sat"]);
	return rolePolicy(toolName, ["payments"]);
}

function rolesForSweepType(
	toolName: string,
	sweepType: unknown,
): ProjectToolPolicy {
	if (typeof sweepType !== "string")
		fail(
			"PROJECT_TOOL_ARGUMENTS_INVALID",
			`${toolName} requires sweepType to be bsv, ordinals, or bsv21`,
		);
	if (sweepType === "bsv") return rolePolicy(toolName, ["payments"]);
	if (sweepType === "ordinals" || sweepType === "bsv21")
		return rolePolicy(toolName, ["one-sat", "payments"]);
	fail(
		"PROJECT_TOOL_ARGUMENTS_INVALID",
		`${toolName} received an unsupported sweepType`,
	);
}

function dynamicPolicy(toolName: string, rawArgs: unknown): ProjectToolPolicy {
	const args = objectArgs(rawArgs);

	if (toolName === "wallet_getPublicKey") {
		if (args.identityKey !== undefined && typeof args.identityKey !== "boolean")
			fail(
				"PROJECT_TOOL_ARGUMENTS_INVALID",
				"wallet_getPublicKey identityKey must be boolean",
			);
		if (args.identityKey === true)
			return rolePolicy(toolName, ["identity-signing"]);
		if (args.protocolIDJSON !== undefined) {
			if (typeof args.protocolIDJSON !== "string")
				fail(
					"PROJECT_TOOL_ARGUMENTS_INVALID",
					"wallet_getPublicKey protocolIDJSON must be JSON text",
				);
			const protocol = parseJsonArray(args.protocolIDJSON, "protocolIDJSON");
			if (
				protocol.length !== 2 ||
				!Number.isInteger(protocol[0]) ||
				typeof protocol[1] !== "string"
			)
				fail(
					"PROJECT_TOOL_ARGUMENTS_INVALID",
					"wallet_getPublicKey protocolIDJSON must contain [securityLevel, protocol]",
				);
			const protocolName = protocol[1];
			if (protocolName === "onesat" || protocolName === "1sat")
				return rolePolicy(toolName, ["one-sat"]);
			if (protocolName === "sigma" || protocolName === "message signing")
				return rolePolicy(toolName, ["identity-signing"]);
		}
		fail(
			"PROJECT_TOOL_ROLE_AMBIGUOUS",
			"wallet_getPublicKey requires identityKey:true or a recognized identity/One Sat protocol; it never uses payments by default",
		);
	}

	if (toolName === "bap_getId") {
		if (args.idKey === undefined || args.idKey === "")
			return rolePolicy(toolName, ["identity-signing"]);
		if (typeof args.idKey !== "string")
			fail(
				"PROJECT_TOOL_ARGUMENTS_INVALID",
				"bap_getId idKey must be a string",
			);
		return publicPolicy(toolName);
	}

	if (toolName === "wallet_createOrdinals") {
		if (args.signWithBAP !== undefined && typeof args.signWithBAP !== "boolean")
			fail(
				"PROJECT_TOOL_ARGUMENTS_INVALID",
				"wallet_createOrdinals signWithBAP must be boolean",
			);
		return args.signWithBAP === true
			? rolePolicy(toolName, ["one-sat", "payments", "identity-signing"])
			: rolePolicy(toolName, ["one-sat", "payments"]);
	}

	if (
		toolName === "wallet_listOutputs" ||
		toolName === "wallet_relinquishOutput"
	) {
		if (args.basket === undefined)
			fail(
				"PROJECT_TOOL_ROLE_AMBIGUOUS",
				`${toolName} requires an explicit basket so asset ownership cannot be routed to payments`,
			);
		if (typeof args.basket !== "string")
			fail(
				"PROJECT_TOOL_ARGUMENTS_INVALID",
				`${toolName} basket must be a string`,
			);
		if (args.basket.length === 0)
			fail(
				"PROJECT_TOOL_ROLE_AMBIGUOUS",
				`${toolName} requires a non-empty basket`,
			);
		return rolesForBasket(toolName, args.basket);
	}

	if (toolName === "wallet_createAction")
		return actionPolicy(toolName, args.outputsJSON, args.labelsJSON);

	if (toolName === "wallet_internalizeAction")
		return actionPolicy(toolName, args.outputsJSON, args.labelsJSON, {
			requireOutputs: true,
		});

	if (toolName === "wallet_listActions") {
		const labels = parseLabelsJSON(args.labelsJSON);
		const kind = classifyLabels(labels);
		if (kind.hasUnknown)
			fail(
				"PROJECT_TOOL_ROLE_AMBIGUOUS",
				"wallet_listActions contains an unknown permission dispatch label",
			);
		return kind.hasAsset
			? rolePolicy(toolName, ["one-sat"])
			: rolePolicy(toolName, ["payments"]);
	}

	if (toolName === "app_sweep_prepare")
		return rolesForSweepType(toolName, args.sweepType);

	if (toolName === "app_sweep_complete") {
		// The opaque reference carries the prepared sweep's role internally. This
		// resolver cannot safely infer that role from `spends`, and the registered
		// schema intentionally has no sweepType argument. Keep the wallet context
		// visible while rejecting Vault dispatch until trusted reference metadata
		// is available.
		return policy(toolName, [], {
			requiredContextGroups: ["wallet"],
			vaultSupport: "unsupported",
			unsupportedReason:
				"Sweep completion is unavailable in Vault mode until its opaque reference is bound to a trusted sweep role.",
		});
	}

	if (
		toolName === "wallet_read" ||
		toolName === "ordinals_read" ||
		toolName === "bsv_read" ||
		toolName === "utility"
	) {
		if (typeof args.operation !== "string")
			fail(
				"PROJECT_TOOL_ARGUMENTS_INVALID",
				`${toolName} requires an operation name`,
			);
		const operationArgs = args.args === undefined ? {} : args.args;
		return resolveProjectToolPolicy(args.operation, operationArgs);
	}

	return (
		PROJECT_TOOL_POLICIES[toolName] ??
		fail(
			"PROJECT_TOOL_UNKNOWN",
			`No project role policy exists for ${toolName}`,
		)
	);
}

/**
 * Resolve the role and context groups before opening a Vault. Request data is
 * used only for the few existing tools whose registered schemas are already
 * conditional; no private key or wallet method is inspected here.
 */
export function resolveProjectToolPolicy(
	toolName: string,
	args?: unknown,
): ProjectToolPolicy {
	if (typeof toolName !== "string" || toolName.length === 0)
		fail("PROJECT_TOOL_UNKNOWN", "Tool name is required");
	const resolved = dynamicPolicy(toolName, args);
	return freeze(resolved);
}

export function assertProjectToolSupported(
	policyValue: ProjectToolPolicy,
): void {
	if (policyValue.vaultSupport === "unsupported")
		fail(
			"PROJECT_TOOL_VAULT_UNSUPPORTED",
			policyValue.unsupportedReason ??
				`${policyValue.toolName} is unavailable in Vault mode`,
		);
}

export type ProjectToolAccounts = Partial<
	Readonly<Record<ProjectToolRole, string | undefined>>
>;

/**
 * Verify the selected role accounts for one operation. A One Sat operation
 * cannot borrow a fee input from a different project account in this runtime.
 */
export function assertProjectToolAccounts(
	policyValue: ProjectToolPolicy,
	accounts: ProjectToolAccounts,
): Readonly<Partial<Record<ProjectToolRole, string>>> {
	if (
		accounts === null ||
		typeof accounts !== "object" ||
		Array.isArray(accounts)
	)
		fail("PROJECT_TOOL_ACCOUNTS_INVALID", "Role accounts must be an object");
	const resolved = {} as Record<ProjectToolRole, string>;
	for (const role of policyValue.requiredRoles) {
		const accountId = accounts[role];
		if (typeof accountId !== "string" || accountId.trim().length === 0)
			fail(
				"PROJECT_TOOL_ROLE_UNASSIGNED",
				`${policyValue.toolName} requires an assigned ${role} role`,
			);
		resolved[role] = accountId;
	}
	if (policyValue.accountConstraint === "same-account") {
		const uniqueAccounts = new Set(Object.values(resolved));
		if (uniqueAccounts.size > 1)
			fail(
				"PROJECT_TOOL_CROSS_ACCOUNT_UNSUPPORTED",
				`${policyValue.toolName} requires ${policyValue.requiredRoles.join(" and ")} from one account; cross-account fee or signer composition is unsupported`,
			);
	}
	return freeze(resolved);
}

export interface ProjectToolRoleSessionEntry {
	readonly accountId: string;
	readonly revision: number;
}

export interface ProjectToolSession {
	readonly projectId: string;
	readonly revision: number;
	readonly roles: Partial<
		Readonly<Record<ProjectToolRole, ProjectToolRoleSessionEntry | undefined>>
	>;
}

/**
 * Require a fresh snapshot of every selected role before dispatch. The
 * caller supplies the revision currently loaded from project configuration;
 * a binding change therefore forces the session to be refreshed.
 */
export function assertProjectToolSession(
	policyValue: ProjectToolPolicy,
	session: ProjectToolSession,
	currentRevision: number,
	expectedProjectId?: string,
): Readonly<Partial<Record<ProjectToolRole, string>>> {
	if (session === null || typeof session !== "object" || Array.isArray(session))
		fail("PROJECT_TOOL_SESSION_INVALID", "Role session must be an object");
	if (!Number.isSafeInteger(currentRevision) || currentRevision < 0)
		fail("PROJECT_TOOL_SESSION_INVALID", "Current role revision is invalid");
	if (
		typeof session.projectId !== "string" ||
		session.projectId.trim().length === 0
	)
		fail("PROJECT_TOOL_SESSION_INVALID", "Role session project ID is required");
	if (
		session.roles === null ||
		typeof session.roles !== "object" ||
		Array.isArray(session.roles)
	)
		fail(
			"PROJECT_TOOL_SESSION_INVALID",
			"Role session roles must be an object",
		);
	if (
		expectedProjectId !== undefined &&
		session.projectId !== expectedProjectId
	)
		fail(
			"PROJECT_TOOL_PROJECT_MISMATCH",
			"The role session belongs to a different project",
		);
	if (
		!Number.isSafeInteger(session.revision) ||
		session.revision !== currentRevision
	)
		fail(
			"PROJECT_TOOL_SESSION_REFRESH_REQUIRED",
			`${policyValue.toolName} has a stale role selection; refresh the project session after changing role bindings`,
		);
	const accounts = {} as Record<ProjectToolRole, string | undefined>;
	for (const role of policyValue.requiredRoles) {
		const entry = session.roles[role];
		if (entry === undefined || entry === null)
			fail(
				"PROJECT_TOOL_SESSION_REFRESH_REQUIRED",
				`${policyValue.toolName} requires a current ${role} role snapshot`,
			);
		if (typeof entry !== "object" || Array.isArray(entry))
			fail(
				"PROJECT_TOOL_SESSION_INVALID",
				`${policyValue.toolName} has an invalid ${role} role snapshot`,
			);
		if (
			typeof entry.accountId !== "string" ||
			entry.accountId.trim().length === 0 ||
			!Number.isSafeInteger(entry.revision) ||
			entry.revision < 0
		)
			fail(
				"PROJECT_TOOL_SESSION_INVALID",
				`${policyValue.toolName} has an invalid ${role} role snapshot`,
			);
		if (entry.revision !== currentRevision)
			fail(
				"PROJECT_TOOL_SESSION_REFRESH_REQUIRED",
				`${policyValue.toolName} requires a current ${role} role snapshot`,
			);
		accounts[role] = entry.accountId;
	}
	return assertProjectToolAccounts(policyValue, accounts);
}
