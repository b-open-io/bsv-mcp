import { homedir } from "node:os";
import { join } from "node:path";
import type { PrivateKey } from "@bsv/sdk";
import { accountName, readAccount } from "./accounts";
import { activateWalletRoles } from "./walletRoleActivation";
import { initWallet, type WalletInitResult } from "./walletInit";
import { walletStorageForPublicKey } from "./walletKeyStorage";

/** Apply saved Vault selections at headless startup as well as browser activation. */
export async function createEmbeddedWalletRuntime(payment: PrivateKey, identity: PrivateKey | undefined, chain: "main" | "test"): Promise<WalletInitResult> {
	if (process.env.BSV_MCP_PASSWORD) {
		const selected = await activateWalletRoles(process.env.VAULT_PATH ?? join(homedir(), ".bsv", "vault.bep"), process.env.BSV_MCP_PASSWORD, accountName());
		if (selected) return selected;
	}
	const primary = await initWallet(payment.toWif(), chain);
	if (!identity || identity.toPublicKey().toString() === payment.toPublicKey().toString()) return primary;
	try {
		const source = readAccount() ?? { chain, address: payment.toAddress(chain === "test" ? [0x6f] : [0x00]), storageIdentityKey: "bsv-mcp", depositPrefix: "mcp" as const };
		const signer = await initWallet(identity.toWif(), chain, { ...walletStorageForPublicKey(accountName(), source, identity.toPublicKey().toString()), trackActive: false });
		return { ...primary, roleContexts: { payments: primary.ctx, identity: signer.ctx, ordinals: primary.ctx }, destroy: async () => { await Promise.allSettled([primary.destroy(), signer.destroy()]); } };
	} catch (error) { await primary.destroy(); throw error; }
}
