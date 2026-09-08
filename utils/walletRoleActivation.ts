import { readAccount } from "./accounts";
import { createEmbeddedVaultIo } from "./embeddedVaultIo";
import { initWallet, type WalletInitResult } from "./walletInit";
import { walletStorageForKey } from "./walletKeyStorage";
import { getWalletRoleSettings, type WalletRole } from "./walletRoleDefaults";

/** Unlock selected Vault entries independently; never reuse one key's database for another. */
export async function activateWalletRoles(
	vaultPath: string,
	password: string,
	fallbackAccount: string,
): Promise<WalletInitResult | undefined> {
	const { effective } = getWalletRoleSettings();
	if (!Object.keys(effective).length) return undefined;
	const payment =
		effective.payments === undefined
			? `${fallbackAccount}:payment`
			: effective.payments;
	if (!payment) throw new Error("Choose a payment key in wallet settings.");
	const selections = {
		payments: payment,
		identity: effective.identity === undefined ? payment : effective.identity,
		ordinals: effective.ordinals === undefined ? payment : effective.ordinals,
	};
	const opened = new Map<string, WalletInitResult>();
	const byRole: Partial<Record<WalletRole, WalletInitResult>> = {};
	try {
		for (const role of ["payments", "identity", "ordinals"] as const) {
			const selected = selections[role];
			if (!selected) continue;
			if (!opened.has(selected)) {
				const [accountName, kind] = selected.split(":");
				const account = readAccount(accountName);
				const binding = account?.vaultBinding;
				const ref = kind === "payment" ? binding?.payment : binding?.identity;
				if (!account || !binding || !ref)
					throw new Error(
						"A selected Vault key is unavailable. Reopen wallet settings.",
					);
				const io = createEmbeddedVaultIo({ vaultPath });
				try {
					const keys = await io.unlock({
						password,
						binding: { vaultId: binding.vaultId, payment: ref },
					});
					if (!keys.payPk)
						throw new Error("The selected Vault key could not be unlocked.");
					const result = await initWallet(keys.payPk, account.chain, {
						...walletStorageForKey(
							accountName,
							keys.payPk.toPublicKey().toString(),
						),
						trackActive: false,
					});
					opened.set(selected, result);
				} finally {
					io.lock();
				}
			}
			byRole[role] = opened.get(selected);
		}
		const primary = byRole.payments;
		if (!primary) throw new Error("The payment key could not be activated.");
		if (
			Object.values(byRole).some(
				(value) => value?.ctx.chain !== primary.ctx.chain,
			)
		)
			throw new Error("Selected role keys must use the same network.");
		return {
			...primary,
			roleContexts: {
				payments: primary.ctx,
				identity: byRole.identity?.ctx,
				ordinals: byRole.ordinals?.ctx,
			},
			destroy: async () => {
				await Promise.allSettled(
					[...opened.values()].map((result) => result.destroy()),
				);
			},
		};
	} catch (error) {
		await Promise.allSettled(
			[...opened.values()].map((result) => result.destroy()),
		);
		throw error;
	}
}
