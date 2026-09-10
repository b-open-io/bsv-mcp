type SourceLike = {
	account: string;
	location: string;
	directory?: string;
	client?: string;
	serverName?: string;
	encryptedBackup?: boolean;
	plaintextKeys?: boolean;
	keyFile?: string;
};

export function migrationSourceCopy(item: SourceLike): {
	title: string;
	origin: string;
	detail: string;
} {
	if (item.location === "mcp-client") {
		return {
			title: item.serverName || item.account,
			origin: `Saved in ${item.client ?? "an MCP client"}`,
			detail:
				"A payment key is still in that client’s MCP config. Import it into Vault, then remove the key from the client config.",
		};
	}
	if (item.location === "environment") {
		return {
			title: "MCP environment payment key",
			origin: "Current MCP server environment",
			detail:
				"A payment key is in the server environment. Import it into Vault and remove PRIVATE_KEY_WIF from the client config.",
		};
	}
	const origin =
		item.location === "legacy-root"
			? "Earlier BSV MCP wallet"
			: item.location === "account"
				? "BSV MCP account"
				: "Configured wallet";
	return {
		title: item.account,
		origin,
		detail: item.encryptedBackup
			? "An encrypted key backup was found. You’ll need its password."
			: item.plaintextKeys
				? `An unencrypted ${item.keyFile ?? "key"} file was found. Importing will add an encrypted copy to Vault.`
				: "Wallet data was found, but no key backup. This source cannot be imported on its own.",
	};
}
