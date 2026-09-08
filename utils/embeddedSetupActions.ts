import { z } from "zod";
import { accountNameSchema, readAccount } from "./accounts";
import { createEmbeddedFirstRunBackend } from "./embeddedFirstRunBackend";
import { createEmbeddedImportBackend } from "./embeddedImportBackend";
import { createEmbeddedWalletActivation } from "./embeddedWalletActivation";
import type { EmbeddedSetupActions } from "./vaultSetup";
import type { WalletInitResult } from "./walletInit";

const createInput = z.object({
	accountName: accountNameSchema,
	password: z.string().min(8),
	passwordConfirmation: z.string(),
	confirmation: z.literal("CREATE_NEW_CONFIRMED"),
});
const unlockInput = z.object({
	accountName: accountNameSchema,
	password: z.string().min(1),
});
const importInput = z.object({
	accountName: accountNameSchema,
	source: z
		.object({
			account: accountNameSchema,
			location: z.enum(["account", "legacy-root", "sigma-lab"]),
			encryptedBackup: z.boolean().default(false),
			plaintextKeys: z.boolean().default(false),
			walletDatabases: z.array(z.string()).default([]),
		})
		.passthrough()
		.optional(),
	backupText: z
		.string()
		.max(1024 * 1024)
		.optional(),
	backupName: z.string().max(255).optional(),
	sourcePassphrase: z.string().optional(),
	destinationPassphrase: z.string().min(8),
	passwordConfirmation: z.string(),
	confirmation: z.literal("IMPORT_WALLET_CONFIRMED"),
});

/** Private HTTP composition boundary: only readiness and public account metadata leave it. */
export function createEmbeddedSetupActions(options: {
	vaultPath: string;
	onActivated: (result: WalletInitResult, accountName: string) => Promise<void>;
}): EmbeddedSetupActions {
	const creator = createEmbeddedFirstRunBackend({
		vaultPath: options.vaultPath,
	});
	const importer = createEmbeddedImportBackend({
		vaultPath: options.vaultPath,
	});
	const activation = createEmbeddedWalletActivation({
		vaultPath: options.vaultPath,
	});
	let busy = false;
	let completed = false;
	async function exclusive(
		action: () => Promise<{
			accountName: string;
			address: string;
			ready: boolean;
		}>,
	) {
		if (busy || completed)
			throw new Error(
				"This setup session has already completed or is busy. Reopen setup to continue.",
			);
		busy = true;
		try {
			return await action();
		} finally {
			busy = false;
		}
	}
	async function activate(accountName: string, password: string) {
		const binding = readAccount(accountName)?.vaultBinding;
		if (!binding)
			throw new Error("This wallet has not been saved in your Vault.");
		const result = await activation.activate({
			accountName,
			password,
			binding,
		});
		try {
			await options.onActivated(result, accountName);
		} catch {
			await result.destroy();
			throw new Error(
				"Your wallet is saved, but could not be connected. Reopen setup to unlock it.",
			);
		}
		completed = true;
		return { accountName, address: result.depositAddress, ready: true };
	}
	return {
		create: (body) =>
			exclusive(async () => {
				const input = createInput.parse(body);
				const saved = await creator.create(input);
				return activate(saved.accountName, input.password);
			}),
		unlock: (body) =>
			exclusive(async () => {
				const input = unlockInput.parse(body);
				return activate(input.accountName, input.password);
			}),
		import: (body) =>
			exclusive(async () => {
				const input = importInput.parse(body);
				let saved: { accountName: string };
				if (input.backupText !== undefined) {
					saved = await importer.importBackup({
						...input,
						backupText: input.backupText,
						backupName: input.backupName ?? "backup",
					});
				} else {
					if (!input.source || input.source.account !== input.accountName)
						throw new Error(
							"Choose the original account name for this local wallet.",
						);
					saved = await importer.import({
						source: input.source as Parameters<
							typeof importer.import
						>[0]["source"],
						password: input.destinationPassphrase,
						passwordConfirmation: input.passwordConfirmation,
						sourcePassphrase: input.sourcePassphrase,
						confirmation: input.confirmation,
					});
				}
				return activate(saved.accountName, input.destinationPassphrase);
			}),
	};
}
