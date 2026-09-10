import { timingSafeEqual } from "node:crypto";
import { lstatSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { accountNameSchema, listAccounts, readAccount } from "./accounts";
import {
	inspectMcpClientKeySources,
	type McpClientEnvVar,
	readMcpClientEnvValue,
} from "./mcpClientKeySources";
import { readWalletSources } from "./walletSettings";

export interface MigrationSource {
	directory?: string;
	keyFile?: "keys.json" | "root.wif";
	storageIdentityKey?: string;
	depositPrefix?: "mcp" | "1sat";
	account: string;
	location: "account" | "legacy-root" | "custom" | "environment" | "mcp-client";
	encryptedBackup: boolean;
	plaintextKeys: boolean;
	walletDatabases: string[];
	envVar?: McpClientEnvVar;
	client?: string;
	serverName?: string;
	configPath?: string;
}
export interface MigrationInventory {
	sources: MigrationSource[];
	boundAccounts?: Array<{ name: string; address: string | null }>;
	vaultExists: boolean;
	environmentKeys: { payment: boolean; identity: boolean; empty: boolean };
	migrationRequired: boolean;
}

/** Inspect filenames only. Detection must never unlock or serialize key material. */
function exists(file: string, directory = false): boolean {
	try {
		const stat = lstatSync(file);
		if (
			stat.isSymbolicLink() ||
			(directory ? !stat.isDirectory() : !stat.isFile())
		)
			throw new Error("Migration paths must be regular files or directories");
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw error;
	}
}

export function inspectMigration(
	options: { home?: string; env?: Record<string, string | undefined> } = {},
): MigrationInventory {
	const home = options.home ?? homedir();
	const env = options.env ?? process.env;
	const base = join(home, ".bsv-mcp");
	const sources: MigrationSource[] = [];
	const inspect = (
		dir: string,
		account: string,
		location: MigrationSource["location"],
		metadata: Pick<
			MigrationSource,
			"keyFile" | "storageIdentityKey" | "depositPrefix"
		> = {},
	) => {
		if (!exists(dir, true)) return;
		const encryptedBackup = exists(join(dir, "keys.bep"));
		const plaintextKeys = exists(join(dir, metadata.keyFile ?? "keys.json"));
		const walletDatabases = [
			"wallet-main.db",
			"wallet-test.db",
			"wallet.db",
		].filter((name) => exists(join(dir, name)));
		if (encryptedBackup || plaintextKeys || walletDatabases.length)
			sources.push({
				directory: dir,
				...metadata,
				account,
				location,
				encryptedBackup,
				plaintextKeys,
				walletDatabases,
			});
	};
	if (exists(base, true)) {
		inspect(base, "default", "legacy-root");
		const root = join(base, "accounts");
		if (exists(root, true)) {
			for (const name of readdirSync(root).sort()) {
				if (accountNameSchema.safeParse(name).success)
					inspect(join(root, name), name, "account");
			}
		}
	}
	for (const { name, directory, ...metadata } of readWalletSources(home)) {
		inspect(directory, name, "custom", metadata);
	}
	if (env.VAULT_PATH === "") throw new Error("VAULT_PATH is set but empty");
	const vaultPath = env.VAULT_PATH ?? join(home, ".bsv", "vault.bep");
	if (env.VAULT_PATH === undefined) exists(join(home, ".bsv"), true);
	const environmentKeys = {
		payment: env.PRIVATE_KEY_WIF !== undefined,
		identity: env.IDENTITY_KEY_WIF !== undefined,
		empty: env.PRIVATE_KEY_WIF === "" || env.IDENTITY_KEY_WIF === "",
	};
	const clientSources = inspectMcpClientKeySources(home);
	sources.push(...clientSources);
	const envPayment = env.PRIVATE_KEY_WIF;
	if (typeof envPayment === "string" && envPayment.length > 0) {
		const listedByClient = clientSources.some((item) => {
			if (item.envVar !== "PRIVATE_KEY_WIF") return false;
			const value = readMcpClientEnvValue(item);
			if (typeof value !== "string" || value.length !== envPayment.length)
				return false;
			return timingSafeEqual(Buffer.from(value), Buffer.from(envPayment));
		});
		if (!listedByClient) {
			sources.push({
				account: "env-payment",
				location: "environment",
				encryptedBackup: false,
				plaintextKeys: true,
				walletDatabases: [],
				envVar: "PRIVATE_KEY_WIF",
			});
		}
	}
	return {
		sources,
		boundAccounts: listAccounts(join(base, "accounts"))
			.filter(
				(item) => readAccount(item.name, join(base, "accounts"))?.vaultBinding,
			)
			.map(({ name, address }) => ({ name, address })),
		vaultExists: exists(vaultPath),
		environmentKeys,
		migrationRequired:
			sources.some((s) => s.encryptedBackup || s.plaintextKeys) ||
			environmentKeys.payment ||
			environmentKeys.identity,
	};
}
