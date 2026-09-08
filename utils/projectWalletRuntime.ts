import { isAbsolute, resolve } from "node:path";
import type { OneSatContext } from "@1sat/actions";
import type { OneSatServices } from "@1sat/client";
import type { WalletInterface } from "@bsv/sdk";
import { VaultWalletError } from "./vaultWallet";
import {
	createVaultWalletController,
	loadInstalledVaultModule,
	type VaultControllerOptions,
	type VaultModule,
} from "./vaultWalletController";

export const PROJECT_WALLET_ROLE = "payments" as const;

/** The non-secret selector for an explicitly configured project wallet. */
export interface ProjectWalletConfig {
	projectRoot: string;
	projectId: string;
}

/**
 * The installed package has not published a stable path type yet. Keep this
 * optional and inspect it only as a local configuration hint; the selected
 * project binding still pins the Vault ID before opening the file.
 */
export type ProjectWalletVaultModule = VaultModule & {
	defaultVaultPath?: string | ((vaultId?: string) => string | Promise<string>);
};
type LoadedVaultModule = ProjectWalletVaultModule;

const PROJECT_CONFLICTS = [
	"BRC100_WALLET_URL",
	"BRC100_WALLET_ORIGINATOR",
	"PRIVATE_KEY_WIF",
	"IDENTITY_KEY_WIF",
	"USE_DROPLIT_API",
	"DROPLIT_API_URL",
	"DROPLIT_FAUCET_NAME",
	"BSV_MCP_ACCOUNT",
	"BSV_CHAIN",
	"REMOTE_STORAGE_URL",
	"BSV_MCP_PASSPHRASE",
] as const;
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

function fail(code: string, message: string): never {
	throw new VaultWalletError(code, message);
}

function explicitPath(value: string | undefined, name: string): string {
	if (!value?.trim()) fail("PROJECT_PATH_INVALID", `${name} is required`);
	if (!isAbsolute(value))
		fail("PROJECT_PATH_INVALID", `${name} must be an absolute path`);
	return resolve(value);
}

/**
 * Read the paired project selector without discovering a project from cwd.
 * This validation deliberately happens before external/local key loading.
 */
export function readProjectWalletConfig(
	env: Record<string, string | undefined> = process.env,
	argv: readonly string[] = process.argv,
): ProjectWalletConfig | undefined {
	const root = env.BSV_MCP_PROJECT_ROOT;
	const id = env.BSV_MCP_PROJECT_ID;
	if (root === undefined && id === undefined) return undefined;
	if (root === undefined || id === undefined)
		fail(
			"PROJECT_CONFIG_INCOMPLETE",
			"BSV_MCP_PROJECT_ROOT and BSV_MCP_PROJECT_ID must be configured together",
		);
	if (!(argv.includes("--stdio") || env.TRANSPORT?.toLowerCase() === "stdio"))
		fail(
			"PROJECT_STDIO_REQUIRED",
			"Project-bound wallets are available only through the stdio transport",
		);
	for (const name of PROJECT_CONFLICTS) {
		if (env[name] !== undefined)
			fail(
				"PROJECT_WALLET_CONFLICT",
				`Project-bound wallet conflicts with ${name}; select one wallet mode`,
			);
	}
	if (!id.trim() || !PROJECT_ID_PATTERN.test(id))
		fail(
			"PROJECT_CONFIG_INVALID",
			"BSV_MCP_PROJECT_ID must match the project role identifier format",
		);
	return {
		projectRoot: explicitPath(root, "BSV_MCP_PROJECT_ROOT"),
		projectId: id,
	};
}

function moduleDefaultPath(
	module: LoadedVaultModule,
	vaultId: string,
): Promise<string> {
	const candidate = module.defaultVaultPath;
	if (typeof candidate === "function")
		return Promise.resolve(candidate(vaultId));
	if (typeof candidate === "string") return Promise.resolve(candidate);
	return Promise.reject(
		new VaultWalletError(
			"VAULT_PATH_UNAVAILABLE",
			"Set VAULT_PATH or install a Vault module with a defaultVaultPath",
		),
	);
}

// Bun and Node expose compatible timer handles with different TypeScript
// names. The runtime only stores and passes the opaque handle back to clear.
type TimerHandle = unknown;

export interface ProjectWalletRuntimeOptions {
	env?: Record<string, string | undefined>;
	argv?: readonly string[];
	projectRoot?: string;
	projectId?: string;
	/** Runtime-only input. It is never returned in status or MCP tool data. */
	passphrase?: string;
	vaultPath?: string;
	ttlSeconds?: number;
	reason?: string;
	loadVaultModule?: () => Promise<ProjectWalletVaultModule>;
	/** Synthetic tests may supply the same seams as the local controller. */
	controllerOptions?: Omit<
		VaultControllerOptions,
		"projectRoot" | "expectedProjectId" | "resolveVaultPath" | "loadVaultModule"
	>;
	lockTimeoutMs?: number;
	terminate?: () => void | Promise<void>;
	schedule?: (callback: () => void, delayMs: number) => TimerHandle;
	clearSchedule?: (timer: TimerHandle) => void;
	now?: () => number;
}

export interface ProjectWalletRuntime {
	readonly projectRoot: string;
	readonly projectId: string;
	readonly role: typeof PROJECT_WALLET_ROLE;
	readonly ctx: OneSatContext;
	readonly wallet: WalletInterface;
	readonly services?: OneSatServices;
	readonly depositAddress: string;
	readonly expiresAt: number;
	readonly controller: ReturnType<typeof createVaultWalletController>;
	/** Lock the session and cancel the expiry callback. */
	readonly cleanup: () => Promise<void>;
}

/**
 * Unlock the explicitly assigned payments role for one stdio child.
 *
 * The raw session wallet is retained only behind a revocable proxy. Every
 * operation re-enters the controller, so expiry or a stale project file is
 * observed even by tools that captured `ctx.wallet` at registration time.
 */
export async function createProjectWalletRuntime(
	options: ProjectWalletRuntimeOptions = {},
): Promise<ProjectWalletRuntime> {
	const env = options.env ?? process.env;
	const argv = options.argv ?? process.argv;
	const config = readProjectWalletConfig(env, argv);
	if (!config)
		fail("PROJECT_CONFIG_REQUIRED", "Project wallet configuration is missing");
	const projectRoot = explicitPath(
		options.projectRoot ?? config.projectRoot,
		"BSV_MCP_PROJECT_ROOT",
	);
	const projectId = options.projectId ?? config.projectId;
	if (!projectId.trim() || !PROJECT_ID_PATTERN.test(projectId))
		fail(
			"PROJECT_CONFIG_INVALID",
			"BSV_MCP_PROJECT_ID must match the project role identifier format",
		);
	const passphrase = options.passphrase ?? env.BSV_MCP_PASSWORD;
	if (!passphrase?.trim())
		fail(
			"PROJECT_PASSWORD_REQUIRED",
			"Project-bound wallets require BSV_MCP_PASSWORD at runtime",
		);

	const loadModule =
		options.loadVaultModule ??
		(() => loadInstalledVaultModule() as Promise<LoadedVaultModule>);
	let modulePromise: Promise<LoadedVaultModule> | undefined;
	const module = () => (modulePromise ??= loadModule());
	const selectedPath = options.vaultPath ?? env.VAULT_PATH;
	const resolveVaultPath = async (vaultId: string) => {
		if (selectedPath !== undefined)
			return explicitPath(selectedPath, "VAULT_PATH");
		return explicitPath(
			await moduleDefaultPath(await module(), vaultId),
			"Vault defaultVaultPath",
		);
	};
	const controller = createVaultWalletController({
		...(options.controllerOptions ?? {}),
		projectRoot,
		expectedProjectId: projectId,
		resolveVaultPath,
		loadVaultModule: module,
	});
	const status = await controller.unlock(
		PROJECT_WALLET_ROLE,
		passphrase,
		options.reason ?? "BSV MCP project payments session",
		options.ttlSeconds,
	);

	let guardedContext: OneSatContext | undefined;
	await controller.run(PROJECT_WALLET_ROLE, async (session) => {
		const wallet = createGuardedWallet(
			controller,
			PROJECT_WALLET_ROLE,
			session.wallet,
		);
		guardedContext = createGuardedContext(session.ctx, wallet);
	});
	if (!guardedContext)
		fail(
			"PROJECT_CONTEXT_UNAVAILABLE",
			"Project wallet context could not be initialized",
		);

	let timer: TimerHandle | undefined;
	let cleaned = false;
	const now = options.now ?? Date.now;
	const clearSchedule =
		options.clearSchedule ??
		((timer: TimerHandle) => {
			if (timer !== undefined && timer !== null)
				clearTimeout(timer as unknown as number);
		});
	const terminate =
		options.terminate ??
		(() => {
			// Signal termination gives the stdio launcher a conventional child exit
			// and lets the process signal handlers finish wallet cleanup. This helper
			// intentionally never calls process.exit().
			process.kill(process.pid, "SIGTERM");
		});
	const lockTimeoutMs = options.lockTimeoutMs ?? 5_000;
	const expire = () => {
		if (cleaned) return;
		void (async () => {
			let lockFinished = false;
			try {
				await Promise.race([
					controller.lock().then(() => {
						lockFinished = true;
					}),
					new Promise<void>((resolveTimeout) =>
						setTimeout(resolveTimeout, lockTimeoutMs),
					),
				]);
			} finally {
				if (!lockFinished)
					console.error(
						"Project wallet cleanup exceeded its timeout; terminating child",
					);
				await terminate();
			}
		})().catch((error) =>
			console.error(
				"Project wallet expiry cleanup failed:",
				error instanceof Error ? error.message : String(error),
			),
		);
	};
	timer = (options.schedule ?? setTimeout)(
		expire,
		Math.max(0, status.expiresAt - now()),
	);

	const cleanup = async () => {
		if (cleaned) return;
		cleaned = true;
		if (timer !== undefined) clearSchedule(timer);
		await controller.lock();
	};
	return Object.freeze({
		projectRoot,
		projectId,
		role: PROJECT_WALLET_ROLE,
		ctx: guardedContext,
		wallet: guardedContext.wallet,
		services: guardedContext.services,
		depositAddress: status.depositAddress,
		expiresAt: status.expiresAt,
		controller,
		cleanup,
	});
}

function createGuardedWallet(
	controller: ReturnType<typeof createVaultWalletController>,
	role: typeof PROJECT_WALLET_ROLE,
	initial: WalletInterface,
): WalletInterface {
	// Do not proxy the SDK wallet object itself: permission wrappers may expose
	// non-configurable method properties, and replacing those methods violates
	// the Proxy invariants. A blank facade keeps the raw object private.
	return new Proxy(Object.create(null) as WalletInterface, {
		get(_target, property) {
			const value = Reflect.get(initial, property, initial);
			if (typeof value !== "function") return value;
			return (...args: unknown[]) =>
				controller.run(role, async (session) => {
					const current = Reflect.get(session.wallet, property, session.wallet);
					if (typeof current !== "function")
						throw new VaultWalletError(
							"WALLET_METHOD_UNAVAILABLE",
							"The selected wallet operation is unavailable",
						);
					return Reflect.apply(current, session.wallet, args);
				});
		},
	}) as WalletInterface;
}

function createGuardedContext(
	initial: OneSatContext,
	wallet: WalletInterface,
): OneSatContext {
	// Preserve non-enumerable owner markers and other context metadata while
	// replacing only the wallet slot. A plain object spread would silently drop
	// those markers and could route an internal derivation as a caller action.
	const descriptors = Object.getOwnPropertyDescriptors(initial);
	Reflect.deleteProperty(descriptors, "wallet");
	const context = Object.create(
		Object.getPrototypeOf(initial),
	) as OneSatContext;
	Object.defineProperties(context, descriptors);
	Object.defineProperty(context, "wallet", {
		value: wallet,
		writable: true,
		enumerable: true,
		configurable: true,
	});
	return context;
}
