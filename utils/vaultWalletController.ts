import { isAbsolute } from "node:path";
import { type AccountConfig, readAccount } from "./accounts";
import {
	assertProjectRoleSnapshotCurrent,
	type ProjectKeyRole,
	type ProjectRoleSnapshot,
	resolveProjectRoleBinding,
} from "./projectRoleBindings";
import { loadProjectRoleBindings } from "./projectRoleBindingsStore";
import {
	createOplVaultLoader,
	openVaultWalletSession,
	type VaultWalletDependencies,
	VaultWalletError,
	type VaultWalletSelection,
	type VaultWalletSession,
} from "./vaultWallet";

const VAULT_PACKAGE = "@opl.dev/vault";
type VaultModule = Parameters<typeof createOplVaultLoader>[0];

/** Runtime optional dependency: reports local availability, not registry status. */
export async function loadInstalledVaultModule(
	importModule: (specifier: string) => Promise<unknown> = (specifier) =>
		import(specifier),
): Promise<VaultModule> {
	let module: unknown;
	try {
		module = await importModule(VAULT_PACKAGE);
	} catch (error) {
		const missing =
			error !== null &&
			typeof error === "object" &&
			"code" in error &&
			["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"].includes(String(error.code));
		throw new VaultWalletError(
			missing ? "VAULT_PACKAGE_MISSING" : "VAULT_PACKAGE_LOAD_FAILED",
			missing
				? "The Vault package or a required dependency is not installed in this runtime."
				: "The installed Vault package could not be loaded.",
		);
	}
	if (
		!module ||
		typeof module !== "object" ||
		!("PassphraseProvider" in module) ||
		typeof module.PassphraseProvider !== "function" ||
		!("openVault" in module) ||
		typeof module.openVault !== "function"
	)
		throw new VaultWalletError(
			"VAULT_PACKAGE_INCOMPATIBLE",
			"The installed Vault package does not provide the supported API.",
		);
	return module as VaultModule;
}

/** Public role snapshot to trusted machine-local wallet selection. */
export function vaultSelectionFromSnapshot(
	snapshot: ProjectRoleSnapshot,
	options: {
		vaultPath: string;
		chain: "main" | "test";
		reason: string;
		ttlSeconds?: number;
	},
): VaultWalletSelection {
	const { binding } = snapshot;
	if (
		binding.keyUseContract !== "direct-v1" ||
		binding.key.derivation !== undefined
	)
		throw new VaultWalletError(
			"UNSUPPORTED_KEY_CONTRACT",
			"This Vault wallet supports directly selected private-key and WIF entries only.",
		);
	return {
		binding: {
			projectId: snapshot.projectId,
			revision: snapshot.revision,
			bindingId: binding.bindingId,
			accountId: binding.accountId,
			vaultId: binding.key.vaultId,
			entryId: binding.key.entryId,
			expectedPublicKey: binding.key.expectedPublicKey,
			keyUseContract: "direct-v1",
		},
		accountName: binding.accountId,
		...options,
	};
}

export interface VaultControllerOptions {
	/** Must come from launcher/local command configuration, never process.cwd(). */
	projectRoot: string;
	expectedProjectId: string;
	/** Machine-local mapping configured by the owner, never a browser path. */
	resolveVaultPath: (vaultId: string) => string | Promise<string>;
	loadBindings?: (
		projectRoot: string,
		expectedProjectId: string,
	) => Promise<unknown>;
	readSelectedAccount?: (name: string) => AccountConfig | undefined;
	loadVaultModule?: () => Promise<VaultModule>;
	walletDependencies?: Omit<VaultWalletDependencies, "openVault">;
}

/** Trusted local API. Passphrases and wallet handles are never JSON responses. */
export function createVaultWalletController(options: VaultControllerOptions) {
	if (!isAbsolute(options.projectRoot) || !options.expectedProjectId)
		throw new VaultWalletError(
			"PROJECT_REQUIRED",
			"An explicit absolute project root and project ID are required.",
		);
	const projectRoot = options.projectRoot;
	const expectedProjectId = options.expectedProjectId;
	let active:
		| { snapshot: ProjectRoleSnapshot; session: VaultWalletSession }
		| undefined;
	let generation = 0;
	const lock = async () => {
		generation += 1;
		const previous = active;
		active = undefined;
		await previous?.session.lock();
	};
	const load = () =>
		(options.loadBindings ?? loadProjectRoleBindings)(
			projectRoot,
			expectedProjectId,
		);
	return Object.freeze({
		projectRoot,
		lock,
		async unlock(
			role: ProjectKeyRole,
			passphrase: string,
			reason: string,
			ttlSeconds = 300,
		) {
			const closing = lock();
			const attempt = generation;
			await closing;
			const snapshot = resolveProjectRoleBinding(
				await load(),
				expectedProjectId,
				role,
			);
			const account = (options.readSelectedAccount ?? readAccount)(
				snapshot.binding.accountId,
			);
			if (!account)
				throw new VaultWalletError(
					"ACCOUNT_UNAVAILABLE",
					"The bound wallet account does not exist.",
				);
			const selection = vaultSelectionFromSnapshot(snapshot, {
				vaultPath: await options.resolveVaultPath(snapshot.binding.key.vaultId),
				chain: account.chain,
				reason,
				ttlSeconds,
			});
			const module = await (
				options.loadVaultModule ?? loadInstalledVaultModule
			)();
			if (attempt !== generation)
				throw new VaultWalletError(
					"UNLOCK_SUPERSEDED",
					"This unlock attempt was canceled or replaced.",
				);
			const session = await openVaultWalletSession(selection, passphrase, {
				...options.walletDependencies,
				openVault: createOplVaultLoader(module),
			});
			try {
				if (attempt !== generation)
					throw new VaultWalletError(
						"UNLOCK_SUPERSEDED",
						"This unlock attempt was canceled or replaced.",
					);
				assertProjectRoleSnapshotCurrent(await load(), snapshot);
				if (attempt !== generation)
					throw new VaultWalletError(
						"UNLOCK_SUPERSEDED",
						"This unlock attempt was canceled or replaced.",
					);
				active = { snapshot, session };
				return Object.freeze({
					projectId: snapshot.projectId,
					role,
					bindingId: snapshot.binding.bindingId,
					publicKey: snapshot.binding.key.expectedPublicKey,
					accountId: snapshot.binding.accountId,
					state: session.state,
					expiresAt: session.expiresAt,
					depositAddress: session.depositAddress,
				});
			} catch (error) {
				await session.lock();
				throw error;
			}
		},
		async run<T>(
			role: ProjectKeyRole,
			operation: (session: VaultWalletSession) => Promise<T>,
		): Promise<T> {
			const current = active;
			if (!current || current.snapshot.binding.role !== role)
				throw new VaultWalletError(
					"SESSION_LOCKED",
					"Unlock the explicitly assigned project role first.",
				);
			try {
				assertProjectRoleSnapshotCurrent(await load(), current.snapshot);
			} catch (error) {
				if (active === current) await lock();
				throw error;
			}
			if (active !== current || current.session.state !== "ready")
				throw new VaultWalletError(
					"SESSION_LOCKED",
					"Unlock the explicitly assigned project role again.",
				);
			return operation(current.session);
		},
	});
}
