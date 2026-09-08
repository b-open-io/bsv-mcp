import { createHash } from "node:crypto";
import { PublicKey } from "@bsv/sdk";
import { type AccountConfig, readAccount } from "./accounts";

/** Preserve a selected account's history only when it belongs to this key. */
export function walletStorageForKey(
	accountName: string,
	publicKey: string,
	accountsRoot?: string,
) {
	const account = readAccount(accountName, accountsRoot);
	if (!account)
		throw new Error("The selected wallet account is not initialized");
	return walletStorageForPublicKey(accountName, account, publicKey);
}

export function walletStorageForPublicKey(accountName: string, account: AccountConfig, publicKey: string) {
	publicKey = PublicKey.fromString(publicKey).toString();
	const address = PublicKey.fromString(publicKey).toAddress(
		account.chain === "test" ? [0x6f] : [0x00],
	);
	const ownsStorage = account.vaultBinding
		? account.vaultBinding.payment.publicKey.toLowerCase() === publicKey
		: account.address === address;
	if (ownsStorage) {
		return { accountName, accountConfig: account };
	}
	const isolated = `key-${createHash("sha256").update(`${account.chain}:${publicKey}`).digest("hex").slice(0, 24)}`;
	const config: AccountConfig = {
		chain: account.chain,
		address,
		storageIdentityKey: isolated,
		depositPrefix: account.depositPrefix,
		...(account.activeRemote === undefined
			? {}
			: { activeRemote: account.activeRemote }),
		...(account.backups === undefined ? {} : { backups: account.backups }),
	};
	return { accountName: isolated, accountConfig: config };
}
