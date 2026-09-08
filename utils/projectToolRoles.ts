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
	"wallet_getAddress",
	"wallet_getBalance",
	"wallet_getLockData",
	"wallet_lockBsv",
	"wallet_unlockBsv",
	"wallet_sendBsv",
	"wallet_sendAllBsv",
	"wallet_sweepBsv",
	"wallet_createAction",
	"wallet_signAction",
	"wallet_abortAction",
	"wallet_internalizeAction",
	"wallet_listActions",
	"mnee_getBalance",
	"mnee_sendMnee",
	"x402_payQuote",
] as const)
	add(policy(name, ["payments"], { feeRole: "payments" }));

// Syncing deposits can internalize BSV, Ordinals and BSV21 outputs, so it
// requires the asset context as well as the account that owns fee inputs.
add(
	policy("wallet_refreshUtxos", ["one-sat", "payments"], {
		feeRole: "payments",
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
	policy("bsocial_createPost", ["identity-signing", "payments"], {
		feeRole: "payments",
		vaultSupport: "unsupported",
		unsupportedReason:
			"The legacy social writer does not accept an explicitly selected identity signer.",
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
	if (typeof value !== "string") return false;
	return /(?:^|[-_.])(ordinals?|tokens?|bsv21|opns|inscriptions?)(?:$|[-_.])/i.test(
		value,
	);
}

function dynamicPolicy(toolName: string, rawArgs: unknown): ProjectToolPolicy {
	const args = objectArgs(rawArgs);

	if (toolName === "wallet_getPublicKey") {
		if (args.identityKey === true)
			return rolePolicy(toolName, ["identity-signing"]);
		fail(
			"PROJECT_TOOL_ROLE_AMBIGUOUS",
			"wallet_getPublicKey requires identityKey:true or a separately selected derivation role; it never uses payments by default",
		);
	}

	if (toolName === "bap_getId") {
		return args.idKey === undefined || args.idKey === ""
			? rolePolicy(toolName, ["identity-signing"])
			: publicPolicy(toolName);
	}

	if (toolName === "wallet_createOrdinals") {
		return args.signWithBAP === true
			? rolePolicy(toolName, ["one-sat", "payments", "identity-signing"])
			: rolePolicy(toolName, ["one-sat", "payments"]);
	}

	if (
		toolName === "wallet_listOutputs" ||
		toolName === "wallet_relinquishOutput"
	) {
		if (typeof args.basket !== "string" || args.basket.length === 0)
			fail(
				"PROJECT_TOOL_ROLE_AMBIGUOUS",
				`${toolName} requires an explicit basket so asset ownership cannot be routed to payments`,
			);
		return assetBasket(args.basket)
			? rolePolicy(toolName, ["one-sat", "payments"])
			: rolePolicy(toolName, ["payments"]);
	}

	if (
		toolName === "wallet_createAction" ||
		toolName === "wallet_internalizeAction"
	) {
		const encoded =
			toolName === "wallet_createAction" ? args.outputsJSON : args.outputsJSON;
		if (encoded === undefined) return rolePolicy(toolName, ["payments"]);
		const outputs = parseJsonArgument(encoded, "outputsJSON");
		if (!Array.isArray(outputs))
			fail(
				"PROJECT_TOOL_ARGUMENTS_INVALID",
				"outputsJSON must contain an array",
			);
		const baskets = outputs
			.filter(
				(output): output is Record<string, unknown> =>
					output !== null &&
					typeof output === "object" &&
					!Array.isArray(output),
			)
			.map((output) => output.basket);
		if (baskets.some(assetBasket))
			return rolePolicy(toolName, ["one-sat", "payments"]);
		if (
			baskets.some(
				(basket) => basket !== undefined && typeof basket !== "string",
			)
		)
			fail(
				"PROJECT_TOOL_ROLE_AMBIGUOUS",
				"Every asset basket must be explicit",
			);
		return rolePolicy(toolName, ["payments"]);
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
	const resolved = {} as Record<ProjectToolRole, string>;
	for (const role of policyValue.requiredRoles) {
		const accountId = accounts[role];
		if (typeof accountId !== "string" || accountId.length === 0)
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
	if (!Number.isSafeInteger(currentRevision) || currentRevision < 0)
		fail("PROJECT_TOOL_SESSION_INVALID", "Current role revision is invalid");
	if (typeof session.projectId !== "string" || session.projectId.length === 0)
		fail("PROJECT_TOOL_SESSION_INVALID", "Role session project ID is required");
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
		if (!entry || entry.revision !== currentRevision)
			fail(
				"PROJECT_TOOL_SESSION_REFRESH_REQUIRED",
				`${policyValue.toolName} requires a current ${role} role snapshot`,
			);
		accounts[role] = entry.accountId;
	}
	return assertProjectToolAccounts(policyValue, accounts);
}
