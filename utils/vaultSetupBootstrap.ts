import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import {
	type AccountVaultMigrationOptions,
	createAccountVaultMigrationBackend,
} from "./vaultMigrationBackend";
import type { VaultMigrationBackend } from "./vaultMigrationWizard";
import { startVaultSetup } from "./vaultSetup";
import { runVaultSetupCommand } from "./vaultSetupCommand";

function unavailable(reason: string): VaultMigrationBackend {
	const fail = async (): Promise<never> => {
		throw new Error(reason);
	};
	return {
		available: false,
		unavailableReason: reason,
		beginUnlock: fail,
		preview: fail,
		cutover: fail,
		lock: async () => {},
	};
}
/** Resolve trusted command configuration; never infer a project from its cwd. */
export async function createConfiguredVaultSetupBackend(
	env: Record<string, string | undefined> = process.env,
	dependencies: {
		createBackend?: typeof createAccountVaultMigrationBackend;
		home?: string;
		backendOptions?: Pick<
			AccountVaultMigrationOptions,
			"accountsDirectory" | "loadModule" | "now"
		>;
	} = {},
): Promise<VaultMigrationBackend> {
	const projectRoot = env.BSV_MCP_PROJECT_ROOT;
	const projectId = env.BSV_MCP_PROJECT_ID;
	if (
		!projectRoot ||
		!projectId ||
		!isAbsolute(projectRoot) ||
		!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(projectId)
	)
		return unavailable(
			"Configure BSV_MCP_PROJECT_ROOT as an absolute project directory and BSV_MCP_PROJECT_ID before enabling migration.",
		);
	const vaultPath =
		env.VAULT_PATH ?? join(dependencies.home ?? homedir(), ".bsv", "vault.bep");
	if (!vaultPath || !isAbsolute(vaultPath))
		return unavailable(
			"VAULT_PATH must be an absolute path to the locally selected encrypted Vault.",
		);
	try {
		return await (
			dependencies.createBackend ?? createAccountVaultMigrationBackend
		)({
			projectRoot,
			expectedProjectId: projectId,
			vaultPath,
			roleAssignments: {},
			...dependencies.backendOptions,
		});
	} catch {
		return unavailable(
			"The configured project or Vault destination is unavailable. Check the local setup configuration.",
		);
	}
}

/** Actual local command bootstrap. Secrets enter only through its local UI. */
export async function runConfiguredVaultSetup(
	options: {
		env?: Record<string, string | undefined>;
		createBackend?: typeof createConfiguredVaultSetupBackend;
		run?: typeof runVaultSetupCommand;
		start?: typeof startVaultSetup;
		open?: (url: string) => Promise<void>;
		log?: (message: string) => void;
	} = {},
): Promise<void> {
	const migrationBackend = await (
		options.createBackend ?? createConfiguredVaultSetupBackend
	)(options.env ?? process.env);
	const log =
		options.log ?? ((message: string) => process.stderr.write(`${message}\n`));
	await (options.run ?? runVaultSetupCommand)({
		start: () => (options.start ?? startVaultSetup)({ migrationBackend }),
		open: options.open,
		log: (message) =>
			log(
				message.startsWith("Vault setup preview is read-only.")
					? migrationBackend.available
						? "Local Vault migration setup is ready. Review and confirm before encrypted import and project role changes; restart or unlock afterward to use them."
						: `Local Vault migration is unavailable: ${migrationBackend.unavailableReason}`
					: message,
			),
	});
}
