import { lstatSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { accountNameSchema } from "./accounts";

export interface MigrationSource {
	account: string;
	location: "account" | "legacy-root" | "sigma-lab";
	encryptedBackup: boolean;
	plaintextKeys: boolean;
	walletDatabases: string[];
}
export interface MigrationInventory {
	sources: MigrationSource[];
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
	) => {
		if (!exists(dir, true)) return;
		const encryptedBackup = exists(join(dir, "keys.bep"));
		const plaintextKeys = exists(
			join(dir, location === "sigma-lab" ? "root.wif" : "keys.json"),
		);
		const walletDatabases = [
			"wallet-main.db",
			"wallet-test.db",
			"wallet.db",
		].filter((name) => exists(join(dir, name)));
		if (encryptedBackup || plaintextKeys || walletDatabases.length)
			sources.push({
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
	const local = join(home, ".local");
	const share = join(local, "share");
	if (exists(local, true) && exists(share, true))
		inspect(join(share, "sigma-brc169-lab"), "sigma-lab", "sigma-lab");
	if (env.VAULT_PATH === "") throw new Error("VAULT_PATH is set but empty");
	const vaultPath = env.VAULT_PATH ?? join(home, ".bsv", "vault.bep");
	if (env.VAULT_PATH === undefined) exists(join(home, ".bsv"), true);
	const environmentKeys = {
		payment: env.PRIVATE_KEY_WIF !== undefined,
		identity: env.IDENTITY_KEY_WIF !== undefined,
		empty: env.PRIVATE_KEY_WIF === "" || env.IDENTITY_KEY_WIF === "",
	};
	return {
		sources,
		vaultExists: exists(vaultPath),
		environmentKeys,
		migrationRequired:
			sources.some((s) => s.encryptedBackup || s.plaintextKeys) ||
			environmentKeys.payment ||
			environmentKeys.identity,
	};
}
