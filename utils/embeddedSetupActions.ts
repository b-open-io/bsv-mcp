import { z } from "zod";
import { accountNameSchema, readAccount } from "./accounts";
import { createEmbeddedFirstRunBackend } from "./embeddedFirstRunBackend";
import { createEmbeddedImportBackend } from "./embeddedImportBackend";
import { createEmbeddedVaultIo } from "./embeddedVaultIo";
import { createEmbeddedWalletActivation } from "./embeddedWalletActivation";
import { eraseImportedPlaintextSource } from "./plaintextSourceErase";
import type { AvailableSetupTool, EmbeddedSetupActions } from "./vaultSetup";
import type { WalletInitResult } from "./walletInit";
import { activateWalletRoles } from "./walletRoleActivation";
import { getWalletRoleSettings } from "./walletRoleDefaults";

const createInput = z.object({
	activate: z.boolean().default(true),
	accountName: accountNameSchema,
	password: z.string().min(12),
	passwordConfirmation: z.string(),
	confirmation: z.literal("CREATE_NEW_CONFIRMED"),
});
const unlockInput = z.object({
	accountName: accountNameSchema,
	password: z.string().min(1).optional(),
	useHardware: z.boolean().optional(),
});
const importInput = z.object({
	activate: z.boolean().default(true),
	accountName: accountNameSchema,
	source: z
		.object({
			account: accountNameSchema,
			location: z.enum([
				"account",
				"legacy-root",
				"custom",
				"environment",
				"mcp-client",
			]),
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
	destinationPassphrase: z.string().min(12),
	passwordConfirmation: z.string(),
	confirmation: z.literal("IMPORT_WALLET_CONFIRMED"),
	eraseSources: z.boolean().optional(),
});

/** Private HTTP composition boundary: only readiness and public account metadata leave it. */
export function createEmbeddedSetupActions(options: {
	vaultPath: string;
	onActivated: (result: WalletInitResult, accountName: string) => Promise<void>;
	getAvailableTools?: () => AvailableSetupTool[];
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
	async function exclusive<T>(action: () => Promise<T>) {
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
		accountName =
			getWalletRoleSettings().effective.payments?.split(":")[0] ?? accountName;
		const binding = readAccount(accountName)?.vaultBinding;
		if (!binding)
			throw new Error("This wallet has not been saved in your Vault.");
		const result =
			(await activateWalletRoles(options.vaultPath, password, accountName)) ??
			(await activation.activate({ accountName, password, binding }));
		try {
			await options.onActivated(result, accountName);
		} catch {
			await result.destroy();
			throw new Error(
				"Your wallet is saved, but could not be connected. Reopen setup to unlock it.",
			);
		}
		const tools = options.getAvailableTools?.();
		completed = true;
		return {
			accountName,
			address: result.depositAddress,
			ready: true,
			...(tools ? { tools } : {}),
		};
	}
	return {
		vaultKeys: (body) =>
			exclusive(async () => {
				const { password } = z
					.object({ password: z.string().min(1) })
					.parse(body);
				return createEmbeddedVaultIo({ vaultPath: options.vaultPath }).listKeys(
					password,
				);
			}),
		linkKey: (body) =>
			exclusive(async () => {
				const input = z
					.object({
						accountName: accountNameSchema,
						password: z.string().min(12),
						vaultId: z.string().min(1),
						entryId: z.string().min(1),
						publicKey: z.string().regex(/^(02|03)[0-9a-fA-F]{64}$/),
					})
					.parse(body);
				const saved = await creator.create({
					accountName: input.accountName,
					password: input.password,
					passwordConfirmation: input.password,
					confirmation: "CREATE_NEW_CONFIRMED",
					existingKey: {
						vaultId: input.vaultId,
						payment: { entryId: input.entryId, publicKey: input.publicKey },
					},
				});
				return {
					accountName: saved.accountName,
					address: saved.address,
					ready: false,
					saved: true,
				};
			}),
		create: (body) =>
			exclusive(async () => {
				const input = createInput.parse(body);
				const saved = await creator.create(input);
				if (!input.activate)
					return {
						accountName: saved.accountName,
						address: readAccount(saved.accountName)?.address ?? "",
						ready: false,
						saved: true,
					};
				return activate(saved.accountName, input.password);
			}),
		unlock: (body) =>
			exclusive(async () => {
				const input = unlockInput.parse(body);
				if (!input.password && !input.useHardware)
					throw new Error(
						"Enter your Vault password, or unlock with this Mac.",
					);
				return activate(input.accountName, input.password ?? "");
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
				const result = input.activate
					? await activate(saved.accountName, input.destinationPassphrase)
					: {
							accountName: saved.accountName,
							address: readAccount(saved.accountName)?.address ?? "",
							ready: false,
							saved: true,
						};
				if (input.eraseSources && input.source)
					eraseImportedPlaintextSource(
						input.source as Parameters<typeof eraseImportedPlaintextSource>[0],
					);
				return result;
			}),
	};
}
