import {
	closeSync,
	fsyncSync,
	mkdirSync,
	openSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { listAccounts, readAccount, regularPath } from "./accounts";
import { readWalletSettings } from "./walletSettings";

export const WALLET_ROLES = ["payments", "identity", "ordinals"] as const;
export type WalletRole = (typeof WALLET_ROLES)[number];
const selector = z
	.string()
	.regex(/^[a-z0-9][a-z0-9_-]{0,63}:(payment|identity)$/);
export const walletRoleDefaultsSchema = z
	.object({
		payments: selector.nullable().optional(),
		identity: selector.nullable().optional(),
		ordinals: selector.nullable().optional(),
	})
	.strict();
export type WalletRoleDefaults = z.infer<typeof walletRoleDefaultsSchema>;
const envNames = {
	payments: "BSV_MCP_PAYMENT_KEY",
	identity: "BSV_MCP_IDENTITY_KEY",
	ordinals: "BSV_MCP_ORDINALS_KEY",
} as const;

export function getWalletRoleSettings(
	home = homedir(),
	env: Record<string, string | undefined> = process.env,
) {
	const settings = readWalletSettings(home);
	const defaults = walletRoleDefaultsSchema.parse(settings.defaults ?? {});
	const effective = { ...defaults };
	const overrides: WalletRole[] = [];
	for (const role of WALLET_ROLES)
		if (env[envNames[role]] !== undefined) {
			effective[role] =
				env[envNames[role]] === "none"
					? null
					: selector.parse(env[envNames[role]]);
			overrides.push(role);
		}
	const root = join(home, ".bsv-mcp", "accounts");
	const keys = listAccounts(root).flatMap(({ name }) => {
		const binding = readAccount(name, root)?.vaultBinding;
		return binding
			? (["payment", "identity"] as const).flatMap((kind) =>
					binding[kind]
						? [
								{
									selector: `${name}:${kind}`,
									accountName: name,
									kind,
									publicKey: binding[kind].publicKey,
								},
							]
						: [],
				)
			: [];
	});
	return {
		defaults,
		effective,
		overrides,
		keys,
		revision: typeof settings.revision === "number" ? settings.revision : 0,
	};
}

export function saveWalletRoleDefaults(
	defaults: unknown,
	expectedRevision: number,
	home = homedir(),
) {
	const parsed = walletRoleDefaultsSchema.parse(defaults);
	const base = join(home, ".bsv-mcp");
	regularPath(base, true);
	mkdirSync(base, { recursive: true, mode: 0o700 });
	const lock = join(base, "settings.json.lock");
	const fd = openSync(lock, "wx", 0o600);
	const temp = join(base, `settings.${process.pid}.tmp`);
	try {
		const current = getWalletRoleSettings(home, {});
		if (current.revision !== expectedRevision)
			throw new Error(
				"Wallet settings changed. Reopen settings and try again.",
			);
		for (const value of Object.values(parsed))
			if (
				value !== null &&
				value !== undefined &&
				!current.keys.some((key) => key.selector === value)
			)
				throw new Error("Choose a key already imported into this Vault.");
		const settings = {
			...readWalletSettings(home),
			defaults: parsed,
			revision: current.revision + 1,
		};
		const out = openSync(temp, "wx", 0o600);
		try {
			writeFileSync(out, `${JSON.stringify(settings, null, 2)}\n`);
			fsyncSync(out);
		} finally {
			closeSync(out);
		}
		renameSync(temp, join(base, "settings.json"));
		return getWalletRoleSettings(home);
	} finally {
		try {
			unlinkSync(temp);
		} catch {}
		closeSync(fd);
		unlinkSync(lock);
	}
}
