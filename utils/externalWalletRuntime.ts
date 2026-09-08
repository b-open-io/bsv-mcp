import type {
	ExternalRoleConfig,
	ExternalWalletConfig,
} from "./externalWalletConfig";
import { initExternalWallet } from "./walletInit";
import type { WalletRoleContexts } from "./walletRoles";

/** Separate signer RPC connections preserve each selected provider's key custody. */
export async function createExternalWalletRuntime(
	config: ExternalWalletConfig,
	chain: "main" | "test",
) {
	if (!config.roles)
		return {
			...(await initExternalWallet(config, chain)),
			roleContexts: undefined,
		};
	const connections = new Map<
		string,
		Awaited<ReturnType<typeof initExternalWallet>>
	>();
	const roleContexts: WalletRoleContexts = { encryption: null };
	try {
		for (const role of [
			"payments",
			"identity",
			"ordinals",
			"encryption",
		] as const) {
			const selected: ExternalRoleConfig | null | undefined =
				config.roles[role];
			if (!selected) continue;
			const key = JSON.stringify([
				selected.url,
				selected.originator,
				selected.expectedPublicKey,
			]);
			let connection = connections.get(key);
			if (!connection) {
				connection = await initExternalWallet(selected, chain);
				connections.set(key, connection);
			}
			roleContexts[role] = connection.ctx;
		}
		const primary =
			roleContexts.payments ?? Object.values(roleContexts).find(Boolean);
		const connection = [...connections.values()].find(
			(value) => value.ctx === primary,
		);
		if (!connection) throw new Error("No external wallet role is available");
		return {
			...connection,
			roleContexts: Object.freeze(roleContexts),
			destroy: async () => {
				await Promise.allSettled(
					[...connections.values()].map((value) => value.destroy()),
				);
			},
		};
	} catch (error) {
		await Promise.allSettled(
			[...connections.values()].map((value) => value.destroy()),
		);
		throw error;
	}
}
